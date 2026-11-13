import { inboxRoute } from '../../../lib/inbox/http'
import { inboxOpenActivity } from '../../../lib/inbox/unread'
export default inboxRoute(async ({ runtime, orgId }) => {
  const openConversations = await inboxOpenActivity(runtime, orgId)
  return { openCount: openConversations.length, openConversations }
})
