import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { member } from './auth'

export const memberPreference = pgTable('member_preference', {
  memberId: text('member_id').primaryKey().references(() => member.id, { onDelete: 'cascade' }),
  notifications: jsonb().$type<{ staff_feedback_email_enabled?: boolean }>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})
