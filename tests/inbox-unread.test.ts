import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import type { InboxRuntime } from '../server/lib/inbox/service'
import { inboxOpenActivity } from '../server/lib/inbox/unread'

test('local unread summary includes every open conversation once and only customer/handoff activity', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE TABLE conversation(id text,org_id text,status text,last_seq bigint);
      CREATE TABLE conversation_item(conversation_id text,seq bigint,author_type text,content jsonb);
      INSERT INTO conversation VALUES ('first','org','open',6),('second','org','open',1),
        ('pending','org','pending',1),('closed','org','closed',1),('ai','org','ai_handling',1),
        ('snoozed','org','snoozed',1),('empty','org','open',0),('foreign','other','open',1);
      INSERT INTO conversation_item VALUES
        ('first',1,'customer','{}'),('first',2,'customer','{}'),
        ('first',3,'system','{"parts":[{"type":"system_event","kind":"handoff"}]}'),
        ('first',4,'staff','{}'),('first',5,'agent','{}'),
        ('first',6,'system','{"parts":[{"type":"system_event","kind":"priority_changed"}]}'),
        ('second',1,'customer','{}'),('foreign',1,'customer','{}');`)
    const runtime = { pool: db } as unknown as InboxRuntime
    const before = await db.query('SELECT * FROM conversation')
    const rows = (await inboxOpenActivity(runtime, 'org')).sort((a, b) => a.id.localeCompare(b.id))
    assert.deepEqual(rows, [{ id: 'first', attentionSeq: 3 }, { id: 'second', attentionSeq: 1 }])
    assert.deepEqual(await db.query('SELECT * FROM conversation'), before)
    await db.exec("UPDATE conversation SET last_seq=7 WHERE id='first'; INSERT INTO conversation_item VALUES ('first',7,'customer','{}')")
    assert.equal((await inboxOpenActivity(runtime, 'org')).find(row => row.id === 'first')!.attentionSeq, 7)
    await db.exec("UPDATE conversation SET status='pending' WHERE id='first'")
    assert.deepEqual(await inboxOpenActivity(runtime, 'org'), [{ id: 'second', attentionSeq: 1 }])
  } finally { await db.close() }
})
