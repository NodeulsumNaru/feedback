import type { H3Event } from 'h3'
import { useNitroApp } from 'nitropack/runtime'
import { consumeInbox, schedulerFailure, withScheduledRuntime, type DelayTransport, type InboxTaskContext, type WakeMessage } from './scheduler'
import { createDomainEvent, publishBackgroundDomainEvent } from '../../utils/domain-events'

const timers = new Map<string, ReturnType<typeof setTimeout>>()
export const INBOX_TOPIC = 'feedlog-inbox'

export function schedulerContext(event?: H3Event): InboxTaskContext {
  const cloudflare = event?.context.cloudflare ?? event?.context._platform?.cloudflare
  if (cloudflare) return { cloudflare }
  if (import.meta.preset?.startsWith('cloudflare')) {
    return { cloudflare: { env: (globalThis as typeof globalThis & { __env__?: NonNullable<InboxTaskContext['cloudflare']>['env'] }).__env__ } }
  }
  return {}
}

export async function consumeBackground(context: InboxTaskContext, message: WakeMessage) {
  const publications: Promise<void>[] = []
  try {
    const result = await withScheduledRuntime(context, input => {
      publications.push(publishBackgroundDomainEvent(createDomainEvent(input)))
    }, runtime => consumeInbox(runtime, delayTransport(context), message))
    if (result.busy) throw new Error('Inbox consumer is busy')
  } finally { await Promise.allSettled(publications) }
}

function arm(message: WakeMessage, milliseconds: number, failures = 0) {
  const old = timers.get(message.id)
  if (old) clearTimeout(old)
  const timer = setTimeout(async () => {
    timers.delete(message.id)
    try { await consumeBackground({}, message) }
    catch (error) {
      console.warn('[inbox] Local consumer failed; retrying saved wake', schedulerFailure(error))
      if (failures < 3) arm(message, 60000, failures + 1)
    }
  }, Math.max(0, Math.min(milliseconds, 2147483647)))
  timer.unref?.()
  timers.set(message.id, timer)
}

export function stopInboxTimers() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
}

export function delayTransport(context: InboxTaskContext = {}): DelayTransport {
  if (context.cloudflare || import.meta.preset?.startsWith('cloudflare')) {
    return { maxDelaySeconds: 23 * 3600, async send(message, delaySeconds) {
      const queue = context.cloudflare?.env?.INBOX_QUEUE
      if (!queue) throw new Error('INBOX_QUEUE binding is not configured')
      await queue.send(message, { delaySeconds })
    } }
  }
  if (import.meta.preset === 'vercel' || process.env.VERCEL === '1') {
    return { maxDelaySeconds: 7 * 86400 - 60, async send(message, delaySeconds) {
      // Leave one minute before the seven-day TTL for receipt/acknowledgement.
      const { send } = await import('@vercel/queue')
      await send(INBOX_TOPIC, message, { delaySeconds, retentionSeconds: 7 * 86400, idempotencyKey: `${message.id}:${message.sentAt}` })
    } }
  }
  return { maxDelaySeconds: 23 * 3600, wakeResolutionMs: 1000, async send(message, delaySeconds) {
    stopInboxTimers()
    arm(message, Math.max(1000, delaySeconds * 1000))
  } }
}

export async function requestSchedule(event?: H3Event, context = schedulerContext(event), strict = false) {
  try {
    const response = await useNitroApp().localFetch('/api/internal/scheduler/schedule', {
      // Nitro forwards localFetch context through _platform; top-level fields
      // are discarded and would make app/cron calls use external recovery rules.
      method: 'POST', context: { _platform: { ...context, inboxSchedule: 'internal' } },
    })
    if (!response.ok) throw Object.assign(new Error('Scheduler API failed'), { statusCode: response.status })
    return await response.json() as { scheduled: boolean; expectAt: string | null }
  } catch (error) {
    const status = (error as { statusCode?: unknown })?.statusCode
    console.warn('[inbox] Scheduler API request failed', { status: typeof status === 'number' ? status : undefined, ...schedulerFailure(error) })
    if (strict) throw new Error('Scheduler API request failed')
  }
}

export async function restoreNodeTimers(schedule = true) {
  await withScheduledRuntime({}, undefined, async runtime => {
    const { rows } = await runtime.pool.query("SELECT id,expect_at,sent_at FROM delay_message WHERE status='scheduled'")
    for (const row of rows) arm({ id: row.id, sentAt: new Date(row.sent_at).toISOString() }, +new Date(row.expect_at) - Date.now())
  })
  if (schedule) await requestSchedule(undefined, {}, true)
}
