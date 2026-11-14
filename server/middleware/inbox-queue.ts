import { defineEventHandler, getHeader, toWebRequest } from 'h3'
import { consumeBackground, INBOX_TOPIC } from '../lib/inbox/platform'
import type { WakeMessage } from '../lib/inbox/scheduler'

// Nitro bundles Vercel routes into one function. Queue triggers target that
// function, so dispatch the CloudEvent before ordinary path-based routing.
export default defineEventHandler(async event => {
  if (import.meta.preset !== 'vercel' && process.env.VERCEL !== '1') return
  if (getHeader(event, 'ce-type') !== 'com.vercel.queue.v2beta') return
  const { handleCallback } = await import('@vercel/queue')
  const handler = handleCallback<WakeMessage>(async (message, metadata) => {
    if (metadata.topicName !== INBOX_TOPIC) throw new Error('Unexpected queue topic')
    await consumeBackground({}, message)
  }, { retry: () => ({ afterSeconds: 60 }) })
  return handler(toWebRequest(event))
})
