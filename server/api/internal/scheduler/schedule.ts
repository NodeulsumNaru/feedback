import { createError, defineEventHandler, getQuery, readBody, setResponseHeader } from 'h3'
import { scheduleInbox, withScheduledRuntime } from '../../../lib/inbox/scheduler'
import { checkRateLimit } from '../../../utils/rateLimit'
import { delayTransport, restoreNodeTimers, schedulerContext } from '../../../lib/inbox/platform'

// Public on purpose: Vercel Cron and self-hosting share this URL, and neither sets a cron secret.
// App-initiated calls may move a wake earlier. HTTP callers only fill a missing or stalled wake.
export default defineEventHandler(async event => {
  if (!['GET','POST'].includes(event.method)) throw createError({ statusCode: 405, message: 'Method not allowed' })
  if (Object.keys(getQuery(event)).length) throw createError({ statusCode: 400, message: 'No parameters accepted' })
  if (event.method === 'POST') {
    const body = await readBody(event)
    if (body != null && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length)) {
      throw createError({ statusCode: 400, message: 'No parameters accepted' })
    }
  }
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const internal = event.context.inboxSchedule === 'internal'
  if (!internal && !await checkRateLimit('inbox-schedule', { limit: 30, windowSeconds: 60, failClosed: true })) {
    throw createError({ statusCode: 429, message: 'Too many scheduler requests' })
  }
  const context = schedulerContext(event)
  return withScheduledRuntime(context, undefined, async runtime => {
    const result = await scheduleInbox(runtime, delayTransport(context), internal ? 'internal' : 'external')
    if (import.meta.preset === 'node-server') await restoreNodeTimers(false)
    return result
  }, { max: internal ? 4 : 1 })
})
