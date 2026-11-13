import { assertConversationImage } from '../../../../../lib/inbox/attachments'
import { inboxRoute, parseInbox } from '../../../../../lib/inbox/http'
import { replyInput } from '../../../../../../shared/inbox/schemas'
import { staffCommand } from '../../../../../lib/inbox/service'
import { deliverReplyNow } from '../../../../../lib/inbox/email'
export default inboxRoute(async ({ event, runtime, orgId, userId, id }) => {
  const input = parseInbox(replyInput, await readBody(event))
  const images = input.content.parts.filter((part) => part.type === 'image')
  if (images.length) {
    const {
      rows: [conversation],
    } = await runtime.pool.query('SELECT user_id FROM conversation WHERE id=$1 AND org_id=$2', [id, orgId])
    if (!conversation) throw createError({ statusCode: 404, message: 'Conversation not found' })
    for (const part of images) {
      assertConversationImage(part.storage_key, useRuntimeConfig(event).public.uploadPrefix, orgId)
      const file = await blobStorage.get(part.storage_key)
      if (!file || !file.type.startsWith('image/') || file.size > 16 * 1024 * 1024)
        throw createError({ statusCode: 422, message: 'Image unavailable' })
    }
  }
  const result = await staffCommand(runtime, id, orgId, userId, { ...input, action: 'reply' })
  setResponseStatus(event, result.replayed ? 200 : 201)
  if (input.notifyByEmail) {
    return { ...result, email: await deliverReplyNow(runtime, orgId, id, result.item.id) }
  }
  const { rows: [task] } = await runtime.pool.query("SELECT status,result,manual_retry,delivery_mode FROM scheduled_task WHERE kind='inbox_email' AND item_id=$1", [result.item.id])
  const email = task ? { status: task.result ?? 'pending', deliveryMode: task.delivery_mode, canRetry: task.status === 'done' && task.result === 'failed' && !task.manual_retry } : null
  return { ...result, email }
})
