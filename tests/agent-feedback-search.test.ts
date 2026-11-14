import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { uuidv7 } from 'uuidv7'
import { searchSimilarByText } from '../server/utils/similar'
import { stripMarkdown } from '../shared/utils/markdown'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
const db = drizzle(pool)
after(() => pool.end())

test('shared feedback search falls back for missing vectors and preserves semantic ranking and tenant scope', async (t) => {
  const orgId = `similar-test-${uuidv7()}`
  const otherOrgId = `similar-test-${uuidv7()}`
  const userId = `similar-user-${uuidv7()}`
  const ids = [uuidv7(), uuidv7(), uuidv7(), uuidv7()]
  const vector = (x: number, y: number) => [x, y, ...Array(766).fill(0)]
  const queryVector = vector(1, 0)
  let enabled = true
  let providerFails = false
  const inputs: string[] = []
  Object.assign(globalThis, {
    useDB: () => db,
    stripMarkdown,
    isEmbeddingEnabled: () => enabled,
    generateEmbedding: async (text: string) => {
      inputs.push(text)
      if (providerFails) throw new Error('Provider unavailable')
      return queryVector
    },
  })
  try {
    for (const id of [orgId, otherOrgId]) await pool.query('INSERT INTO organization (id,name,slug) VALUES ($1,$1,$1)', [id])
    await pool.query('INSERT INTO "user" (id,name,email) VALUES ($1,$1,$2)', [userId, `${userId}@example.invalid`])
    for (const [index, id] of ids.entries()) {
      const tenant = index === 3 ? otherOrgId : orgId
      const title = index === 1 ? 'Export reports' : 'Add dark mode support'
      await pool.query('INSERT INTO post (id,org_id,author_id,title,content,slug,merged_to) VALUES ($1::uuid,$2,$3,$4::text,$4::text,$1::text,$5::uuid)', [id, tenant, userId, title, index === 2 ? ids[0] : null])
      await pool.query('INSERT INTO post_search (post_id,org_id,search_text) VALUES ($1,$2,$3)', [id, tenant, title])
    }
    const query = '**dark mode night mode theme support**'
    const options = { orgId, userId, limit: 8 }

    await t.test('an empty vector index still returns text candidates', async () => {
      const hits = await searchSimilarByText(query, options)
      assert.deepEqual(hits.map(hit => hit.id), ids.slice(0, 2))
      assert.deepEqual(inputs, ['dark mode night mode theme support'])
    })

    for (const [index, id] of ids.entries()) {
      await pool.query('INSERT INTO post_embedding (post_id,org_id,embedding,model,content_hash) VALUES ($1,$2,$3::vector,$4,$5)', [id, index === 3 ? otherOrgId : orgId, JSON.stringify(index === 0 ? vector(0, 1) : queryVector), 'test-model', 'test-hash'])
    }
    await t.test('vectors determine order and exclude merged and other-tenant feedback', async () => {
      const hits = await searchSimilarByText(query, options)
      assert.deepEqual(hits.map(hit => hit.id), [ids[1], ids[0]])
      assert.deepEqual((await searchSimilarByText(query, { ...options, limit: 1 })).map(hit => hit.id), [ids[1]])
    })

    await t.test('a provider failure falls back to text similarity', async () => {
      providerFails = true
      assert.deepEqual((await searchSimilarByText(query, options)).map(hit => hit.id), ids.slice(0, 2))
    })

    await t.test('an unconfigured provider is skipped', async () => {
      enabled = false
      const count = inputs.length
      assert.deepEqual((await searchSimilarByText(query, options)).map(hit => hit.id), ids.slice(0, 2))
      assert.equal(inputs.length, count)
    })
  } finally {
    await pool.query('DELETE FROM post WHERE id=ANY($1::uuid[])', [ids])
    await pool.query('DELETE FROM "user" WHERE id=$1', [userId])
    await pool.query('DELETE FROM organization WHERE id=ANY($1::text[])', [[orgId, otherOrgId]])
  }
})
