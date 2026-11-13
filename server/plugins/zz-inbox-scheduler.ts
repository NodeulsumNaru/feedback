import { consumeBackground, restoreNodeTimers, stopInboxTimers } from '../lib/inbox/platform'
import { schedulerFailure, type InboxTaskContext, type WakeMessage } from '../lib/inbox/scheduler'

export default defineNitroPlugin(async nitroApp => {
  if (import.meta.preset?.startsWith('cloudflare')) {
    nitroApp.hooks.hook('cloudflare:queue', async ({ batch, env }) => {
      for (const message of batch.messages) {
        try {
          await consumeBackground({ cloudflare: { env: env as NonNullable<InboxTaskContext['cloudflare']>['env'] } }, message.body as WakeMessage)
          message.ack()
        } catch {
          console.warn('[inbox] Worker queue consumer failed')
          message.retry({ delaySeconds: 60 })
        }
      }
    })
  } else if (import.meta.preset !== 'vercel' && process.env.VERCEL !== '1') {
    let retry: ReturnType<typeof setTimeout> | undefined
    const restore = async () => {
      try {
        await restoreNodeTimers()
        console.info('[inbox] Scheduler startup recovery completed')
      }
      catch (error) {
        console.warn('[inbox] Scheduler startup recovery unavailable; retrying', schedulerFailure(error))
        retry = setTimeout(restore, 60000)
        retry.unref?.()
      }
    }
    // Plugins finish registering before localFetch enters the scheduler route.
    retry = setTimeout(restore, 0)
    nitroApp.hooks.hook('close', () => { clearTimeout(retry); stopInboxTimers() })
  }
})
