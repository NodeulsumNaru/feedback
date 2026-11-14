import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { z } from 'zod'
import { helpArticleSearchInput, helpArticleSearchDescription, searchHelpArticles } from '../server/lib/agent/help-search'

const args = process.argv.slice(2)
function requiredArg(name: string) {
  const index = args.indexOf(name)
  const value = index < 0 ? undefined : args[index + 1]
  if (!value || value.startsWith('--')) throw new Error('Required arguments: --org <id> --origin <url> --input <json> --out <directory>')
  return value
}
const orgId = requiredArg('--org')
const origin = new URL(requiredArg('--origin')).origin
const inputPath = resolve(requiredArg('--input'))
const outputPath = resolve(requiredArg('--out'))
const inputText = await readFile(inputPath, 'utf8')
const dataset = z.object({
  schema_version: z.literal(1),
  description: z.string(),
  cases: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    source_case_id: z.string().optional(),
    source_message_id: z.string().optional(),
    source_text: z.string().optional(),
    legacy_queries: z.array(z.string().min(1).max(300)).min(1),
    queries: helpArticleSearchInput.shape.queries,
    expected_groups: z.array(z.array(z.string().min(1)).min(1)),
    expect_empty: z.boolean(),
    note: z.string(),
  })),
}).parse(JSON.parse(inputText))
if (new Set(dataset.cases.map(c => c.id)).size !== dataset.cases.length) throw new Error('Duplicate case IDs')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c default_transaction_read_only=on',
  max: 4,
})
type Article = { article_id: string; title: string; description: string | null }
function score(articles: Article[], expected: string[][]) {
  const matched = expected.map(group => {
    const rank = articles.findIndex(article => group.includes(article.title))
    return { alternatives: group, rank: rank < 0 ? null : rank + 1 }
  })
  return {
    result_count: articles.length,
    expected_groups_found: matched.filter(group => group.rank !== null).length,
    expected_group_count: expected.length,
    all_expected_groups_found: expected.length > 0 && matched.every(group => group.rank !== null),
    any_expected_group_found: matched.some(group => group.rank !== null),
    matches: matched,
  }
}
const results = []
const startedAt = new Date().toISOString()
const trackedFiles = [
  'server/lib/agent/help-search.ts',
  'server/lib/agent/tools.ts',
  'server/utils/help-search.ts',
  'shared/utils/markdown.ts',
]
const layerRoot = fileURLToPath(new URL('..', import.meta.url))
const codeHashes = Object.fromEntries(await Promise.all(trackedFiles.map(async file => [
  file, createHash('sha256').update(await readFile(resolve(layerRoot, file))).digest('hex'),
])))
try {
  const { rows: [environment] } = await pool.query('SELECT current_database() AS database, version() AS postgres')
  const { rows: corpus } = await pool.query(
    "SELECT a.id,a.title,a.description,a.content,a.tsv::text,a.updated_at,a.ai_enabled,a.status,c.visible FROM help_article a JOIN help_collection c ON c.id=a.collection_id AND c.org_id=a.org_id WHERE a.org_id=$1 AND a.ai_enabled ORDER BY a.id",
    [orgId],
  )
  if (!corpus.length) throw new Error('No AI-enabled articles for this organization')
  const titles = new Set(corpus.map(article => article.title))
  for (const c of dataset.cases) {
    for (const group of c.expected_groups) {
      if (!group.some(title => titles.has(title))) throw new Error('Expected article missing for ' + c.id)
    }
    const legacyGroups = []
    for (const query of c.legacy_queries) {
      const start = performance.now()
      const { rows } = await pool.query<Article>(
        "SELECT a.id AS article_id,a.title,a.description FROM help_article a JOIN help_collection c ON c.id=a.collection_id WHERE a.org_id=$1 AND a.status='published' AND c.visible AND (a.tsv @@ plainto_tsquery('english',$2) OR a.title ILIKE '%'||$2||'%') ORDER BY ts_rank(a.tsv,plainto_tsquery('english',$2)) DESC LIMIT 8",
        [orgId, query],
      )
      legacyGroups.push({ query, articles: rows, elapsed_ms: performance.now() - start })
    }
    const legacyAll = [...new Map(legacyGroups.flatMap(group => group.articles).map(article => [article.article_id, article])).values()]
    const shortStart = performance.now()
    const single = await searchHelpArticles(pool, orgId, { queries: [c.queries[0]!] }, origin)
    const singleTime = performance.now() - shortStart
    const batchStart = performance.now()
    const batch = await searchHelpArticles(pool, orgId, { queries: c.queries }, origin)
    const batchTime = performance.now() - batchStart
    const repeated = await searchHelpArticles(pool, orgId, { queries: c.queries }, origin)
    if (JSON.stringify(batch) !== JSON.stringify(repeated)) throw new Error('Unstable result order for ' + c.id)
    if (new Set(batch.articles.map(a => a.article_id)).size !== batch.articles.length) throw new Error('Duplicate result for ' + c.id)
    const result = {
      ...c,
      legacy_first: { articles: legacyGroups[0]!.articles, metrics: score(legacyGroups[0]!.articles, c.expected_groups) },
      legacy_all: { calls: legacyGroups, articles: legacyAll, metrics: score(legacyAll, c.expected_groups) },
      single_short: { ...single, elapsed_ms: singleTime, metrics: score(single.articles, c.expected_groups) },
      batch: { ...batch, elapsed_ms: batchTime, metrics: score(batch.articles, c.expected_groups) },
      checks: { deterministic_on_repeat: true, unique_article_ids: true, within_limit: batch.articles.length <= 12 },
    }
    results.push(result)
    console.log(c.id + ': batch ' + result.batch.metrics.expected_groups_found + '/' + c.expected_groups.length + ' expected groups; ' + batch.articles.length + ' articles')
  }
  for (const [file, hash] of Object.entries(codeHashes)) {
    if (createHash('sha256').update(await readFile(resolve(layerRoot, file))).digest('hex') !== hash) throw new Error('Source changed during evaluation: ' + file)
  }
  const summary = Object.fromEntries((['legacy_first', 'legacy_all', 'single_short', 'batch'] as const).map(mode => {
    const positive = results.filter(result => result.expected_groups.length > 0)
    const controls = results.filter(result => result.expect_empty)
    return [mode, {
      positive_cases: positive.length,
      cases_with_any_expected_group: positive.filter(result => result[mode].metrics.any_expected_group_found).length,
      cases_with_all_expected_groups: positive.filter(result => result[mode].metrics.all_expected_groups_found).length,
      expected_groups_found: positive.reduce((sum, result) => sum + result[mode].metrics.expected_groups_found, 0),
      expected_group_count: positive.reduce((sum, result) => sum + result.expected_groups.length, 0),
      empty_controls: controls.length,
      empty_controls_passed: controls.filter(result => result[mode].metrics.result_count === 0).length,
    }]
  }))
  await mkdir(outputPath, { recursive: true })
  await writeFile(resolve(outputPath, 'results.json'), JSON.stringify({
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    agent_invoked: false,
    llm_invoked: false,
    database_read_only: true,
    org_id: orgId,
    origin,
    environment,
    corpus_count: corpus.length,
    corpus_sha256: createHash('sha256').update(JSON.stringify(corpus)).digest('hex'),
    dataset_sha256: createHash('sha256').update(inputText).digest('hex'),
    code_hashes: codeHashes,
    summary,
    cases: results,
  }, null, 2) + '\n')
  await writeFile(resolve(outputPath, 'corpus.json'), JSON.stringify(corpus, null, 2) + '\n')
  await writeFile(resolve(outputPath, 'tool-definition.json'), JSON.stringify({
    id: 'search_help_articles',
    description: helpArticleSearchDescription,
    inputSchema: z.toJSONSchema(helpArticleSearchInput),
  }, null, 2) + '\n')
  console.log(JSON.stringify(summary, null, 2))
} finally {
  await pool.end()
}
