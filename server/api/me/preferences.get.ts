import { findOwnMemberPreference } from '../../services/member-preferences'
import { resolveMemberNotifications } from '../../../shared/schemas/member-preference'

export default defineEventHandler(async (event) => {
  const { session, orgId } = await requireOrgMember(event)
  const row = await findOwnMemberPreference(useDB(), orgId, session.user.id)
  if (!row) throw createError({ statusCode: 403, message: 'Not a member of this organization' })
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return {
    notifications: resolveMemberNotifications(row.preference?.notifications),
    organization: row.organization,
    email: row.email,
    role: row.role,
  }
})
