import { inboxRoute, parseInbox } from '../../../../lib/inbox/http'
import { listInput } from '../../../../../shared/inbox/schemas'
import { listConversations } from '../../../../lib/inbox/queries'
export default inboxRoute(({ event, runtime, orgId }) =>
  listConversations(runtime, orgId, parseInbox(listInput, getQuery(event))),
)
