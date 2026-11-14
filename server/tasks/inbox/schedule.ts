import { requestSchedule } from '../../lib/inbox/platform'
import { schedulerFailure, type InboxTaskContext } from '../../lib/inbox/scheduler'

export default defineTask({
  meta: { name: 'inbox:schedule', description: 'Recover missing delayed Inbox deliveries' },
  async run({ context }) {
    try {
      const result = await requestSchedule(undefined, context as InboxTaskContext, true)
      console.info('[inbox] Cron schedule API completed', result)
      return { result }
    } catch (error) {
      console.error('[inbox] Cron schedule API failed', schedulerFailure(error))
      throw error
    }
  },
})
