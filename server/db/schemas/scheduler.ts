import { pgTable, uuid, text, timestamp, integer, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const scheduledTask = pgTable('scheduled_task', {
  id: uuid().primaryKey(),
  scheduleAt: timestamp('schedule_at', { withTimezone: true }).notNull(),
  status: text().notNull().default('pending'),
  kind: text().notNull(),
  refId: uuid('ref_id'),
  // Reply IDs are text (including idempotent cmd: IDs), not UUIDs.
  itemId: text('item_id'),
  result: text(),
  attempts: integer().notNull().default(0),
  manualRetry: boolean('manual_retry').notNull().default(false),
  // Email tasks retain the selected policy across retries and restarts.
  deliveryMode: text('delivery_mode').$type<'auto' | 'immediate'>().notNull().default('auto'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('idx_scheduled_task_due').on(t.scheduleAt, t.id).where(sql`${t.status} = 'pending'`),
  index('idx_scheduled_task_processing').on(t.updatedAt).where(sql`${t.status} = 'processing'`),
  uniqueIndex('scheduled_task_reference').on(t.kind, t.refId).where(sql`${t.itemId} IS NULL`),
  uniqueIndex('scheduled_task_reply').on(t.itemId).where(sql`${t.kind} = 'inbox_email'`),
])

export const delayMessage = pgTable('delay_message', {
  id: uuid().primaryKey(),
  expectAt: timestamp('expect_at', { withTimezone: true }).notNull(),
  status: text().notNull().default('scheduled'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  firedAt: timestamp('fired_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('idx_delay_message_active').on(t.expectAt, t.id).where(sql`${t.status} = 'scheduled'`)])
