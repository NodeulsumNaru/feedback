import type { InboxRuntime } from './service'

// Read positions live in the browser; the server only supplies current activity.
export async function inboxOpenActivity(runtime: InboxRuntime, orgId: string) {
  const { rows } = await runtime.pool.query<{ id: string; attention_seq: string | number }>(`SELECT c.id,
    coalesce((SELECT max(i.seq) FROM conversation_item i WHERE i.conversation_id=c.id
      AND (i.author_type='customer' OR (i.author_type='system'
        AND i.content @> '{"parts":[{"type":"system_event","kind":"handoff"}]}'::jsonb))),0) AS attention_seq
    FROM conversation c WHERE c.org_id=$1 AND c.status='open' AND c.last_seq>0`, [orgId])
  return rows.map(row => ({ id: row.id, attentionSeq: Number(row.attention_seq) }))
}
