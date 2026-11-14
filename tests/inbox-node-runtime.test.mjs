import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { Pool } from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { randomUUID } from 'node:crypto'

const url = process.env.DATABASE_URL ?? ''
assert.match(url, /@(?:localhost|127\.0\.0\.1):\d+\/feedlog_inbox_mvp$/)
assert.equal(JSON.parse(await readFile('.output/nitro.json','utf8')).preset, 'node-server', 'Run pnpm build before this test')

test('built Node server recovers tasks through cron and restart using the shared scheduler API', { timeout: 390000 }, async () => {
  const admin = new Pool({ connectionString: url })
  const name = `feedlog_inbox_mvp_runtime_${Date.now()}`
  const target = new URL(url); target.pathname = `/${name}`
  await admin.query(`CREATE DATABASE "${name}"`)
  const pool = new Pool({ connectionString: target.toString() })
  let child
  const stop = async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      await exited
    }
    child = undefined
  }
  const boot = async () => {
    child = spawn(process.execPath, ['.output/server/index.mjs'], { stdio: 'ignore', env: {
      PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '3149', TZ: 'UTC',
      DATABASE_URL: target.toString(), BETTER_AUTH_SECRET: 'synthetic-local-scheduler-test-secret',
      BETTER_AUTH_URL: 'http://127.0.0.1:3149', EMAIL_PROVIDER: 'console',
    } })
    for (let i=0; i<100; i++) {
      if (child.exitCode !== null) throw new Error('Test server exited during startup')
      try {
        const response = await fetch('http://127.0.0.1:3149/api/internal/scheduler/schedule')
        if (response.ok) return
      } catch { /* Not listening yet. */ }
      await delay(100)
    }
    throw new Error('Test server did not become ready')
  }
  const expectDone = async (id, timeoutMs = 10000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if ((await pool.query('SELECT status FROM scheduled_task WHERE id=$1', [id])).rows[0]?.status === 'done') return
      await delay(100)
    }
    assert.fail('Persisted task was not consumed before its recovery deadline')
  }
  try {
    const connection = postgres(target.toString(), { max: 1 })
    try { await migrate(drizzle(connection), { migrationsFolder: 'server/db/migrations' }) }
    finally { await connection.end() }
    const first = randomUUID()
    await pool.query("INSERT INTO scheduled_task(id,kind,ref_id,schedule_at) VALUES ($1,'inbox_due',$2,now()-interval '1 minute')", [first,randomUUID()])
    await boot()
    await expectDone(first)
    const post = await fetch('http://127.0.0.1:3149/api/internal/scheduler/schedule', { method: 'POST' })
    assert.equal(post.status, 200)
    assert.deepEqual(Object.keys(await post.json()).sort(), ['expectAt','scheduled'])
    assert.equal((await fetch('http://127.0.0.1:3149/api/internal/scheduler/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"task":"injected"}' })).status, 400)
    assert.equal((await fetch('http://127.0.0.1:3149/api/internal/scheduler/schedule?task=injected')).status, 400)
    // An earlier task whose scheduling call was lost must be picked up by cron,
    // even with a future wake already present. This also checks that Nitro
    // forwards the trusted internal context through the real API boundary.
    const future = randomUUID()
    const missing = randomUUID()
    await pool.query("INSERT INTO scheduled_task(id,kind,ref_id,schedule_at) VALUES ($1,'inbox_due',$2,now()+interval '1 hour')", [future,randomUUID()])
    assert.equal((await fetch('http://127.0.0.1:3149/api/internal/scheduler/schedule')).status, 200)
    await pool.query("INSERT INTO scheduled_task(id,kind,ref_id,schedule_at) VALUES ($1,'inbox_due',$2,now()-interval '1 minute')", [missing,randomUUID()])
    await expectDone(missing, 310000)
    assert.equal((await pool.query('SELECT status FROM scheduled_task WHERE id=$1', [future])).rows[0].status, 'pending')
    await pool.query('DELETE FROM scheduled_task WHERE id=$1', [future])
    await stop()
    const second = randomUUID()
    await pool.query("INSERT INTO scheduled_task(id,kind,ref_id,schedule_at) VALUES ($1,'inbox_due',$2,now()-interval '1 minute')", [second,randomUUID()])
    await pool.query("INSERT INTO delay_message(id,expect_at,sent_at) VALUES ($1,now()-interval '1 minute',date_trunc('milliseconds',now()-interval '2 minutes'))", [randomUUID()])
    await boot()
    await expectDone(second)
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM scheduled_task WHERE status='pending'")).rows[0].n, 0)
  } finally {
    await stop(); await pool.end()
    await admin.query(`DROP DATABASE "${name}"`); await admin.end()
  }
})
