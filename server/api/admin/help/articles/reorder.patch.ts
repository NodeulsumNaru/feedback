import { and, eq } from 'drizzle-orm'
import { helpArticle } from '#layers/feedlog/server/db/schemas'
import { reorderHelpArticleSchema } from '#layers/feedlog/shared/schemas/help'

export default defineEventHandler(async (event) => {
  const { orgId } = await requireOrgPermission(event, { feedlog: ['moderate'] })
  const body = await readValidatedBody(event, reorderHelpArticleSchema.parse)

  const db = useDB()
  await Promise.all(
    body.ids.map((id, index) =>
      db.update(helpArticle).set({ position: index }).where(and(
        eq(helpArticle.id, id),
        eq(helpArticle.orgId, orgId),
        eq(helpArticle.collectionId, body.collectionId),
      )),
    ),
  )

  setResponseStatus(event, 204)
  return null
})
