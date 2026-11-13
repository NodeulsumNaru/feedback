import { handling } from '../../../../shared/inbox/state'
import { and, desc, eq, gt, sql } from 'drizzle-orm'
import { conversation, conversationItem } from '#layers/feedlog/server/db/schemas'
import { withinRetention } from '#layers/feedlog/server/utils/conversation'

export interface WidgetConversationItem {
  id: string
  title: string | null
  firstUserText: string | null
  preview: string | null
  lastMessageAt: Date
  lastSeq: number
  unread: boolean
  handling: 'ai' | 'human' | 'closed'
}

// The visitor's own conversations, newest first. Unpaged: a visitor accumulates
// a handful of these, not a feed.
export default defineEventHandler(async (event): Promise<{ data: WidgetConversationItem[] }> => {
  const { session, orgId } = await requireAuthInOrg(event)

  const rows = await useDB()
    .select({
      id: conversation.id,
      status: conversation.status,
      title: conversation.title,
      preview: conversation.previewText,
      lastMessageAt: conversation.lastMessageAt,
      unread: conversation.unread,
      lastSeq: conversation.lastSeq,
      firstUserText: sql<string | null>`(
        SELECT string_agg(part->>'text', ' ' ORDER BY ordinal)
        FROM (SELECT content FROM ${conversationItem} WHERE conversation_id = "conversation"."id" AND author_type = 'customer' ORDER BY seq LIMIT 1) first_item,
        jsonb_array_elements(first_item.content->'parts') WITH ORDINALITY AS p(part, ordinal)
        WHERE part->>'type' = 'text'
      )`,
    })
    .from(conversation)
    .where(and(
      eq(conversation.orgId, orgId),
      eq(conversation.userId, session.user.id),
      withinRetention(orgId),
      gt(conversation.lastSeq, 0),
    ))
    .orderBy(desc(conversation.lastMessageAt), desc(conversation.id))

  return { data: rows.map(({ status, ...row }) => ({ ...row, handling: handling(status) })) }
})
