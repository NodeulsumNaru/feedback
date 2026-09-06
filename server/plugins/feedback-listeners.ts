import { and, eq } from 'drizzle-orm'
import { member, post } from '../db/schemas'

// First in-process subscribers to feedback.created: embedding generation and
// the staff notification. As listeners they follow every entry point that
// publishes the event and stay off the response path. Each loads what it
// needs by id — the event payload is deliberately minimal — and fails
// independently: the dispatcher contains a listener error without touching
// the other listener or the business response.

async function loadFeedbackPost(feedbackId: string) {
  const [row] = await useDB()
    .select({
      id: post.id,
      slug: post.slug,
      title: post.title,
      content: post.content,
      contentHash: post.contentHash,
    })
    .from(post)
    .where(eq(post.id, feedbackId))
    .limit(1)
  return row ?? null
}

// The create endpoints read "actor is staff" off the session's org list; a
// listener has no session, so it asks the member table — the source that org
// list mirrors.
async function actorIsOrgAdmin(orgId: string, userId: string): Promise<boolean> {
  const [row] = await useDB()
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
    .limit(1)
  return row?.role === 'owner' || row?.role === 'manager'
}

export default defineNitroPlugin((nitroApp) => {
  onDomainEvent(nitroApp, 'feedback.created', async (domainEvent) => {
    const row = await loadFeedbackPost(domainEvent.data.feedbackId)
    // No row: deleted between commit and listener run. No hash: a legacy row
    // this event cannot describe — every path that publishes writes one.
    if (!row || !row.contentHash) return
    await generatePostEmbedding(row.id, domainEvent.orgId, row.title, row.content, row.contentHash)
  })

  onDomainEvent(nitroApp, 'feedback.created', async (domainEvent, context) => {
    // No user behind the event (system-initiated) — nobody to attribute, and
    // staff filing feedback is routine work, not something to alert staff about.
    if (!domainEvent.userId) return
    if (await actorIsOrgAdmin(domainEvent.orgId, domainEvent.userId)) return
    const row = await loadFeedbackPost(domainEvent.data.feedbackId)
    if (!row) return
    await emitAdminNotification({
      orgId: domainEvent.orgId,
      typeKey: 'post.created',
      postSlug: row.slug,
      postTitle: row.title,
      snippet: row.content,
      actorId: domainEvent.userId,
      requestOrigin: context?.requestOrigin,
    })
  })
})
