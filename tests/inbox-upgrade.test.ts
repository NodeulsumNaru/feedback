import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Pool } from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const migrationsFolder = process.env.INBOX_MIGRATIONS_DIR ?? 'server/db/migrations'
const url = process.env.DATABASE_URL ?? ''
assert.match(url, /@(?:localhost|127\.0\.0\.1):\d+\/feedlog_inbox_mvp$/)

for (const baseline of ['legacy', 'main']) test(`upgrade from ${baseline} preserves existing rows and rerunning migrations is safe`, async () => {
  const admin = new Pool({ connectionString: url })
  const database = `feedlog_inbox_mvp_upgrade_${Date.now()}`
  const folder = await mkdtemp(join(tmpdir(), 'inbox-upgrade-'))
  await admin.query(`CREATE DATABASE "${database}"`)
  const target = new URL(url)
  target.pathname = `/${database}`
  const connection = postgres(target.toString(), { max: 1 })
  try {
    const journal = JSON.parse(await readFile(join(migrationsFolder, 'meta/_journal.json'), 'utf8'))
    const old = { ...journal, entries: journal.entries.filter((e: { when: number, tag: string }) => e.when <= 1789634235516 || (baseline === 'main' && ['0015_widget_launcher_config', '0016_member_preferences'].includes(e.tag))) }
    await mkdir(join(folder, 'meta'))
    await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify(old))
    for (const entry of old.entries)
      await copyFile(join(migrationsFolder, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`))
    const db = drizzle(connection)
    await migrate(db, { migrationsFolder: folder })
    await connection`INSERT INTO organization(id,name,slug) VALUES ('upgrade-test','Upgrade','upgrade-test')`
    await connection`INSERT INTO "user"(id,name,email) VALUES ('upgrade-user','Customer','upgrade@example.invalid')`
    const id = '019919fa-1200-7000-8000-000000000001'
    await connection`INSERT INTO conversation(id,org_id,user_id,last_seq,title,preview_text) VALUES (${id},'upgrade-test','upgrade-user',1,'Original title','Original content')`
    await connection`INSERT INTO conversation_item(id,conversation_id,seq,author_type,author_user_id,content) VALUES ('upgrade-message',${id},1,'customer','upgrade-user','{"parts":[{"type":"text","text":"Original content"}]}')`
    await connection`INSERT INTO post(id,org_id,author_id,title,content,slug) VALUES ('019919fa-1200-7000-8000-000000000002','upgrade-test','upgrade-user','Original feedback','Unchanged content','upgrade-feedback')`
    const before = {
      conversation: (await connection`SELECT row_to_json(c) AS row FROM conversation c WHERE id=${id}`)[0]!.row,
      item: (await connection`SELECT row_to_json(i) AS row FROM conversation_item i WHERE id='upgrade-message'`)[0]!
        .row,
      post: (await connection`SELECT row_to_json(p) AS row FROM post p WHERE slug='upgrade-feedback'`)[0]!.row,
    }
    await migrate(db, { migrationsFolder })
    await migrate(db, { migrationsFolder })
    assert.equal((await connection`SELECT count(*)::int AS count FROM scheduled_task`)[0]!.count, 0)
    assert.equal((await connection`SELECT to_regclass('public.scheduler_http_limit') AS table_name`)[0]!.table_name, null)
    await connection`SELECT delivery_mode FROM scheduled_task LIMIT 0`
    const [conversation] = await connection`SELECT row_to_json(c) AS row FROM conversation c WHERE id=${id}`
    const { status, priority, state_due_at, customer_read_seq, ...oldConversation } = conversation!.row
    assert.equal(customer_read_seq, 0)
    assert.deepEqual(oldConversation, before.conversation)
    assert.deepEqual([status, priority, state_due_at], ['ai_handling', 0, null])
    const [item] = await connection`SELECT row_to_json(i) AS row FROM conversation_item i WHERE id='upgrade-message'`
    const { request_hash, ...oldItem } = item!.row
    assert.equal(request_hash, null)
    assert.deepEqual(oldItem, before.item)
    const [post] = await connection`SELECT row_to_json(p) AS row FROM post p WHERE slug='upgrade-feedback'`
    const { source_conversation_id, ...oldPost } = post!.row
    assert.equal(source_conversation_id, null)
    assert.deepEqual(oldPost, before.post)
  } finally {
    await connection.end()
    await admin.query(`DROP DATABASE "${database}"`)
    await admin.end()
    await rm(folder, { recursive: true, force: true })
  }
})

test('upgrade leaves historical AI runs unchanged and creates no scheduled tasks', async () => {
  const admin = new Pool({ connectionString: url })
  const database = `feedlog_inbox_mvp_backfill_${Date.now()}`
  const folder = await mkdtemp(join(tmpdir(), 'inbox-backfill-'))
  await admin.query(`CREATE DATABASE "${database}"`)
  const target = new URL(url); target.pathname = `/${database}`
  const connection = postgres(target.toString(), { max: 1 })
  try {
    const journal = JSON.parse(await readFile(join(migrationsFolder, 'meta/_journal.json'), 'utf8'))
    const schedulerIndex = journal.entries.findIndex((e: { tag: string }) => e.tag === '0017_inbox')
    assert.ok(schedulerIndex > 0)
    const old = { ...journal, entries: journal.entries.slice(0, schedulerIndex) }
    await mkdir(join(folder, 'meta'))
    await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify(old))
    for (const entry of old.entries) await copyFile(join(migrationsFolder, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`))
    const db = drizzle(connection)
    await migrate(db, { migrationsFolder: folder })
    await connection`INSERT INTO organization(id,name,slug) VALUES ('backfill','Backfill','backfill')`
    await connection`INSERT INTO "user"(id,name,email) VALUES ('backfill-user','Customer','backfill@example.invalid')`
    const id = '019919fa-1200-7000-8000-000000000011'
    const runId = '019919fa-1200-7000-8000-000000000012'
    await connection`INSERT INTO conversation(id,org_id,user_id,last_seq,unread) VALUES (${id},'backfill','backfill-user',1,true)`
    await connection`INSERT INTO conversation_item(id,conversation_id,seq,author_type,author_user_id,content) VALUES ('backfill-input',${id},1,'customer','backfill-user','{"parts":[{"type":"text","text":"Question"}]}')`
    await connection`INSERT INTO agent_run(id,conversation_id,trigger_item_id,idempotency_key,deadline_at) VALUES (${runId},${id},'backfill-input','backfill-run',now()+interval '1 minute')`
    const [runBefore] = await connection`SELECT * FROM agent_run WHERE id=${runId}`
    await migrate(db, { migrationsFolder })
    await migrate(db, { migrationsFolder })
    const [runAfter] = await connection`SELECT * FROM agent_run WHERE id=${runId}`
    assert.deepEqual(runAfter, runBefore)
    const tasks = await connection`SELECT kind,ref_id,schedule_at,status FROM scheduled_task ORDER BY kind`
    assert.equal(tasks.length, 0)
    const [row] = await connection`SELECT customer_read_seq FROM conversation WHERE id=${id}`
    assert.equal(Number(row!.customer_read_seq), 0)
  } finally {
    await connection.end(); await admin.query(`DROP DATABASE "${database}"`); await admin.end()
    await rm(folder, { recursive: true, force: true })
  }
})


test('repeat migrations preserve live Inbox state and match a fresh installation schema', async () => {
  const admin = new Pool({ connectionString: url })
  const folder = await mkdtemp(join(tmpdir(), 'inbox-reconcile-'))
  const journal = JSON.parse(await readFile(join(migrationsFolder, 'meta/_journal.json'), 'utf8'))
  const old = journal
  await mkdir(join(folder, 'meta'))
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify(old))
  for (const entry of old.entries) await copyFile(join(migrationsFolder, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`))
  const schemas = []
  try {
    for (const baseline of ['fresh', 'inbox', 'main']) {
      const database = `feedlog_inbox_mvp_reconcile_${baseline}_${Date.now()}`
      await admin.query(`CREATE DATABASE "${database}"`)
      const target = new URL(url); target.pathname = `/${database}`
      const connection = postgres(target.toString(), { max: 1 })
      try {
        const db = drizzle(connection)
        if (baseline === 'main') {
          const main = { ...journal, entries: journal.entries.filter((e: { when: number, tag: string }) => e.when <= 1789634235516 || ['0015_widget_launcher_config', '0016_member_preferences'].includes(e.tag)) }
          await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify(main))
        }
        if (baseline !== 'fresh') await migrate(db, { migrationsFolder: folder })
        let before
        if (baseline === 'inbox') {
          await connection`INSERT INTO organization(id,name,slug) VALUES ('live','Live','live')`
          await connection`INSERT INTO "user"(id,name,email) VALUES ('live','Live','live@example.invalid')`
          await connection`INSERT INTO conversation(id,org_id,user_id,last_seq,status,state_due_at,customer_read_seq,unread) VALUES ('019919fa-1200-7000-8000-000000000099','live','live',3,'pending',now()+interval '5 minutes',1,false)`
          await connection`INSERT INTO scheduled_task(id,kind,ref_id,schedule_at,status,result,attempts) SELECT '019919fa-1200-7000-8000-000000000098','inbox_due',id,state_due_at,'done','preserved',2 FROM conversation`
          before = { conversations: [...await connection`SELECT * FROM conversation`], tasks: [...await connection`SELECT * FROM scheduled_task`] }
        }
        await migrate(db, { migrationsFolder })
        await migrate(db, { migrationsFolder })
        if (before) {
          assert.deepEqual([...await connection`SELECT * FROM conversation`], before.conversations)
          assert.deepEqual([...await connection`SELECT * FROM scheduled_task`], before.tasks)
        }
        schemas.push({
          columns: [...await connection`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`],
          constraints: [...await connection`SELECT c.relname,p.conname,pg_get_constraintdef(p.oid) AS definition FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,p.conname`],
          indexes: [...await connection`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`],
        })
      } finally {
        await connection.end(); await admin.query(`DROP DATABASE "${database}"`)
      }
    }
    assert.deepEqual(schemas[1], schemas[0])
    assert.deepEqual(schemas[2], schemas[0])
  } finally {
    await admin.end(); await rm(folder, { recursive: true, force: true })
  }
})
