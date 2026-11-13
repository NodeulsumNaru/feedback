import { pgTable, text, boolean, varchar, jsonb, timestamp, uuid, integer, bigint, primaryKey, index, check, smallint, unique } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { organization } from './auth'
import { CONVERSATION_RETENTION_DEFAULT_DAYS } from '../../../shared/constants/conversation'
import type { WidgetCustomRule } from '../../../shared/constants/widget-rules'
import { WIDGET_LAUNCHER_CONFIG_DEFAULT, type WidgetLauncherConfig } from '../../../shared/constants/widget-launcher'

// One row per org, created lazily on first save (no row = all defaults). Writes
// go through a validating server endpoint, never a client-side metadata write.
export const organizationWidget = pgTable('organization_widget', {
  orgId: text('org_id').primaryKey().references(() => organization.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  supportEmail: varchar('support_email', { length: 320 }),
  disabledBuiltins: jsonb('disabled_builtins').$type<string[]>().notNull().default([]),
  customRules: jsonb('custom_rules').$type<WidgetCustomRule[]>().notNull().default([]),
  conversationRetentionDays: integer('conversation_retention_days').notNull().default(CONVERSATION_RETENTION_DEFAULT_DAYS),
  launcherConfig: jsonb('launcher_config').$type<WidgetLauncherConfig>().notNull().default(WIDGET_LAUNCHER_CONFIG_DEFAULT),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const organizationWidgetRelations = relations(organizationWidget, ({ one }) => ({
  organization: one(organization, { fields: [organizationWidget.orgId], references: [organization.id] }),
}))

// A row = the post author has an unread admin update; no row = none. Written on
// admin reply / status change (author only), deleted when the author opens it.
export const postUnread = pgTable('post_unread', {
  postId: uuid('post_id').notNull(),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.postId, t.userId] }),
])

// One widget chat thread, visible only to the visitor who started it. Created
// lazily with its first message, so a row here always has at least one.
export const conversation = pgTable('conversation', {
  id: uuid().primaryKey().$defaultFn(() => uuidv7()),
  orgId: text('org_id').notNull(),
  userId: text('user_id').notNull(),
  status: text().$type<'ai_handling' | 'open' | 'pending' | 'snoozed' | 'closed'>().notNull().default('ai_handling'),
  priority: smallint().notNull().default(0),
  stateDueAt: timestamp('state_due_at', { withTimezone: true }),
  // NULL = never reached a terminal reply; the list falls back to the first message.
  title: varchar({ length: 200 }),
  previewText: text('preview_text'),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
  unread: boolean().notNull().default(false),
  customerReadSeq: bigint('customer_read_seq', { mode: 'number' }).notNull().default(0),
  lastSeq: bigint('last_seq', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_conversation_owner').on(t.orgId, t.userId, sql`${t.lastMessageAt} DESC`, sql`${t.id} DESC`),
  index('idx_conversation_unread').on(t.orgId, t.userId, sql`${t.lastMessageAt} DESC`, sql`${t.id} DESC`).where(sql`${t.unread} = true AND ${t.lastSeq} > 0`),
  unique('conversation_org_id_unique').on(t.orgId, t.id),
  index('idx_inbox_status_time').on(t.orgId, t.status, sql`${t.lastMessageAt} DESC`, sql`${t.id} DESC`),
  index('idx_inbox_time').on(t.orgId, sql`${t.lastMessageAt} DESC`, sql`${t.id} DESC`),
  index('idx_conversation_due').on(t.stateDueAt, t.id).where(sql`${t.stateDueAt} IS NOT NULL`),
  check('conversation_status', sql`${t.status} IN ('ai_handling','open','pending','snoozed','closed')`),
  check('conversation_priority', sql`${t.priority} IN (0,1)`),
  check('conversation_state_due', sql`${t.status} = 'ai_handling' OR (${t.status} IN ('pending','snoozed') AND ${t.stateDueAt} IS NOT NULL) OR (${t.status} IN ('open','closed') AND ${t.stateDueAt} IS NULL)`),
  check('conversation_last_seq', sql`${t.lastSeq} >= 0`),
])

// Both sides of a conversation, in the order they happened.
export const message = pgTable('message', {
  id: uuid().primaryKey().$defaultFn(() => uuidv7()),
  conversationId: uuid('conversation_id').notNull(),
  role: varchar({ length: 16 }).notNull(),
  // assistant only: which of the four AI outcomes this turn was.
  kind: varchar({ length: 16 }),
  text: text().notNull(),
  images: jsonb().$type<string[]>().notNull().default([]),
  // A pointer, not a snapshot — the card renders the post's current values, and
  // a deleted post just stops joining.
  postId: uuid('post_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_message_conversation').on(t.conversationId, t.createdAt, t.id),
])
