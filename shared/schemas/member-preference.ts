import { z } from 'zod'

export const updateMemberPreferenceSchema = z.strictObject({
  notifications: z.strictObject({
    staff_feedback_email_enabled: z.boolean(),
  }),
})

export type MemberPreferenceUpdate = z.infer<typeof updateMemberPreferenceSchema>

const storedNotificationsSchema = z.object({
  staff_feedback_email_enabled: z.boolean().default(true),
})

// Only absent settings inherit defaults. Corrupt data must never opt someone in.
export function resolveMemberNotifications(stored: unknown = {}) {
  return storedNotificationsSchema.parse(stored)
}

export interface MemberPreferenceResponse {
  notifications: ReturnType<typeof resolveMemberNotifications>
  organization: { id: string; name: string }
  email: string
  role: string
}
