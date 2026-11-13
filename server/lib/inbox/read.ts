import type { InboxRuntime } from './service'

export async function markCustomerRead(runtime: InboxRuntime, id: string, orgId: string, userId: string, retentionDays: number, observedSeq: number) {
  const { rows: [row] } = await runtime.pool.query(`UPDATE conversation
    SET unread=CASE WHEN last_seq=$5 THEN false ELSE unread END,
        customer_read_seq=greatest(customer_read_seq,$5)
    WHERE id=$1 AND org_id=$2 AND user_id=$3 AND last_seq>0 AND $5<=last_seq
      AND last_message_at>now()-make_interval(days=>$4)
    RETURNING last_seq=$5 AS cleared`, [id, orgId, userId, retentionDays, observedSeq])
  return row as { cleared: boolean } | undefined
}
