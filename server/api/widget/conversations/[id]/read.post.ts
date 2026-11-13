import { z } from 'zod'
import { widgetActor, agentRuntime, withAgentRuntime, agentError } from '#layers/feedlog/server/lib/agent/runtime'
import { countWidgetBadge } from '#layers/feedlog/server/utils/widget-unread'
import { markCustomerRead } from '../../../../lib/inbox/read'

export default defineEventHandler(event => withAgentRuntime(event, async () => {
  const actor = await widgetActor(event)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) agentError(404, 'conversation_not_found', 'Conversation not found')
  const body = z.object({ observed_last_seq: z.number().int().positive().safe() }).strict().safeParse(await readBody(event).catch(() => null))
  if (!body.success) agentError(422, 'invalid_message', 'The displayed message sequence is required')
  const row = await markCustomerRead(agentRuntime(event), id.data, actor.orgId, actor.customerId, actor.retentionDays, body.data.observed_last_seq)
  if (!row) agentError(404, 'conversation_not_found', 'Conversation not found')
  return { cleared: row.cleared, ...await countWidgetBadge(actor.orgId, actor.customerId) }
}))
