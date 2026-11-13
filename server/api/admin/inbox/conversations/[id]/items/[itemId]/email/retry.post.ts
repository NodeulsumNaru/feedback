import { z } from 'zod'
import { inboxRoute, parseInbox } from '../../../../../../../../lib/inbox/http'
import { deliverReplyNow, retryReplyEmail } from '../../../../../../../../lib/inbox/email'
export default inboxRoute(async ({ event, runtime, orgId, id }) => {
  parseInbox(z.object({}).strict(), await readBody(event))
  const itemId = parseInbox(z.string().min(1).max(100), getRouterParam(event, 'itemId'))
  await retryReplyEmail(runtime, orgId, id, itemId)
  return { itemId, email: await deliverReplyNow(runtime, orgId, id, itemId) }
})
