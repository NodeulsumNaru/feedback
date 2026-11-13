import { and, eq } from 'drizzle-orm'
import { helpCollection } from '#layers/feedlog/server/db/schemas'
import { reorderHelpCollectionSchema } from '#layers/feedlog/shared/schemas/help'

export default defineEventHandler(async (event) => {
  const { orgId } = await requireOrgPermission(event, { feedlog: ['moderate'] })
  const body = await readValidatedBody(event, reorderHelpCollectionSchema.parse)

  const db = useDB()
  await Promise.all(
    body.ids.map((id, index) =>
      db.update(helpCollection).set({ position: index }).where(and(eq(helpCollection.id, id), eq(helpCollection.orgId, orgId))),
    ),
  )

  setResponseStatus(event, 204)
  return null
})
