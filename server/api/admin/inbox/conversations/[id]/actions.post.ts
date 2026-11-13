import { inboxRoute, parseInbox } from '../../../../../lib/inbox/http'
import { actionInput } from '../../../../../../shared/inbox/schemas'
import { staffCommand } from '../../../../../lib/inbox/service'
export default inboxRoute(async ({ event, runtime, orgId, userId, id }) =>
  staffCommand(runtime, id, orgId, userId, parseInbox(actionInput, await readBody(event))),
)
