import { inboxRoute, parseInbox } from '../../../../../lib/inbox/http'
import { pageInput } from '../../../../../../shared/inbox/schemas'
import { readInbox } from '../../../../../lib/inbox/queries'
export default inboxRoute(({ event, runtime, orgId, id }) =>
  readInbox(runtime, orgId, id, parseInbox(pageInput, getQuery(event))),
)
