import type { PoolClient } from 'pg'
import type { DomainEventInput } from '../../utils/domain-events'

export type InboxEvent =
  | DomainEventInput<'inbox.handoff'>
  | DomainEventInput<'inbox.staff-replied'>
  | DomainEventInput<'inbox.closed'>
const pending = new WeakMap<PoolClient, InboxEvent[]>()

// Request-local notifications are published only after the business commit.
export function queueInboxEvent(client: PoolClient, event: InboxEvent) {
  pending.set(client, [...(pending.get(client) ?? []), event])
}
export function takeInboxEvents(client: PoolClient) {
  const events = pending.get(client) ?? []
  pending.delete(client)
  return events
}
