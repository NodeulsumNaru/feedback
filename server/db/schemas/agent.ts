import { pgTable, text, uuid, bigint, timestamp, jsonb, index, uniqueIndex, check, foreignKey } from 'drizzle-orm/pg-core'
import type { PgTableExtraConfigValue } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { Content, PageContext } from '../../../shared/agent/content'
import type { RunTokenUsage } from '../../../shared/agent/usage'

import { user } from './auth'
import { conversation } from './widget'
export const conversationItem = pgTable('conversation_item', {
  id: text().primaryKey(), conversationId: uuid('conversation_id').notNull().references(() => conversation.id),
  seq: bigint({ mode: 'number' }).notNull(), authorType: text('author_type').$type<'customer' | 'agent' | 'staff' | 'system'>().notNull(),
  authorUserId: text('author_user_id').references(() => user.id), content: jsonb().$type<Content>().notNull(),
  requestHash: text('request_hash'),
  context: jsonb().$type<PageContext>(), agentRunId: uuid('agent_run_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t): PgTableExtraConfigValue[] => [
  foreignKey({ columns: [t.agentRunId], foreignColumns: [agentRun.id] }),
  uniqueIndex('agent_item_conversation_seq').on(t.conversationId, t.seq), uniqueIndex('agent_item_run').on(t.agentRunId),
  check('item_id', sql`length(${t.id}) BETWEEN 1 AND 100`),
  check('item_seq', sql`${t.seq} > 0`),
  check('item_request_hash', sql`${t.requestHash} IS NULL OR ${t.requestHash} ~ '^[0-9a-f]{64}$'`),
  check('item_author', sql`(${t.authorType} = 'customer' AND ${t.authorUserId} IS NOT NULL AND ${t.agentRunId} IS NULL) OR (${t.authorType} = 'agent' AND ${t.authorUserId} IS NULL AND ${t.agentRunId} IS NOT NULL AND ${t.context} IS NULL) OR (${t.authorType} = 'staff' AND ${t.authorUserId} IS NOT NULL AND ${t.agentRunId} IS NULL AND ${t.context} IS NULL) OR (${t.authorType} = 'system' AND ${t.agentRunId} IS NULL AND ${t.context} IS NULL)`),
  check('item_content', sql`${t.content} ? 'parts' AND jsonb_typeof(${t.content}) = 'object' AND jsonb_typeof(${t.content}->'parts') = 'array' AND jsonb_array_length(${t.content}->'parts') > 0`),
])
export const agentRun = pgTable('agent_run', {
  id: uuid().primaryKey(), conversationId: uuid('conversation_id').notNull().references(() => conversation.id),
  triggerItemId: text('trigger_item_id').notNull(), idempotencyKey: text('idempotency_key').notNull(),
  status: text().$type<'running' | 'completed' | 'failed' | 'cancelled'>().notNull().default('running'),
  usage: jsonb().$type<RunTokenUsage>(),
  error: text(), startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  deadlineAt: timestamp('deadline_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (t): PgTableExtraConfigValue[] => [
  foreignKey({ columns: [t.triggerItemId], foreignColumns: [conversationItem.id] }),
  uniqueIndex('agent_run_request').on(t.conversationId, t.idempotencyKey),
  uniqueIndex('agent_run_active').on(t.conversationId).where(sql`${t.status} = 'running'`),
  uniqueIndex('agent_run_completed_input').on(t.triggerItemId).where(sql`${t.status} = 'completed'`),
  index('agent_run_history').on(t.conversationId, t.startedAt, t.id), index('agent_run_attempts').on(t.triggerItemId, t.startedAt, t.id),
  check('run_key', sql`length(${t.idempotencyKey}) BETWEEN 1 AND 100`),
  check('run_deadline', sql`${t.deadlineAt} > ${t.startedAt}`),
  check('run_terminal', sql`(${t.status} = 'running' AND ${t.finishedAt} IS NULL AND ${t.error} IS NULL) OR (${t.status} IN ('completed', 'cancelled') AND ${t.finishedAt} IS NOT NULL AND ${t.finishedAt} >= ${t.startedAt} AND ${t.error} IS NULL) OR (${t.status} = 'failed' AND ${t.error} IS NOT NULL AND ${t.finishedAt} IS NOT NULL AND ${t.finishedAt} >= ${t.startedAt} AND length(${t.error}) > 0)`),
])
