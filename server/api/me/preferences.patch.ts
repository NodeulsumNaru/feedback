import { findOwnMemberPreference, saveMemberNotifications } from '../../services/member-preferences'
import { updateMemberPreferenceSchema } from '../../../shared/schemas/member-preference'

export default defineEventHandler(async (event) => {
  const { session, orgId } = await requireOrgMember(event)
  const parsed = updateMemberPreferenceSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid member preferences' })
  const db = useDB()
  const row = await findOwnMemberPreference(db, orgId, session.user.id)
  if (!row) throw createError({ statusCode: 403, message: 'Not a member of this organization' })
  const notifications = await saveMemberNotifications(db, row.memberId, parsed.data.notifications)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return { notifications, organization: row.organization, email: row.email, role: row.role }
})
