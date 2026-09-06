import { createPostSchema } from '#layers/feedlog/shared/schemas/post'
import { isActorAdmin } from '#layers/feedlog/shared/utils/notifications'

// POST /api/posts — Create a post (any authenticated user: end-user or staff).
export default defineEventHandler(async (event) => {
  const { session, orgId } = await requireAuthInOrg(event)
  await assertGuestMay(event, session, 'allowPost')

  const body = await readValidatedBody(event, createPostSchema.parse)

  const created = await createPostRecord({
    orgId,
    authorId: session.user.id,
    title: body.title,
    content: body.content,
    boardId: body.boardId,
    subscribeAuthor: !isActorAdmin(session, orgId),
  })

  publishDomainEvent(event, createDomainEvent({
    name: 'feedback.created',
    orgId,
    userId: session.user.id,
    data: { feedbackId: created.id, boardId: created.boardId, source: 'portal', messageId: null },
  }))

  const author = await fetchPostAuthor(session.user.id)

  setResponseStatus(event, 201)
  return {
    id: created.id,
    slug: created.slug,
    title: created.title,
    content: created.content,
    status: created.status,
    boardId: created.boardId,
    voteCount: created.voteCount,
    commentCount: created.commentCount,
    mergedCount: 0,
    mergedTo: null,
    hasVoted: false,
    author: author ?? { id: session.user.id, name: null, image: null },
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  } satisfies PostDetail
})
