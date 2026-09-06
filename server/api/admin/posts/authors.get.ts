import { eq, desc, sql } from 'drizzle-orm'
import { post, user } from '#layers/feedlog/server/db/schemas'

// GET /api/admin/posts/authors — candidate values for the Author filter.
// Not narrowed by the active filters, and merged posts count toward the total.
export default defineEventHandler(async (event) => {
  const { orgId } = await requireOrgMember(event)

  const db = useDB()
  const total = sql<number>`cast(count(*) as int)`

  const rows = await db
    .select({
      id: post.authorId,
      name: user.name,
      email: user.email,
      image: user.image,
      count: total,
    })
    .from(post)
    .leftJoin(user, eq(post.authorId, user.id))
    .where(eq(post.orgId, orgId))
    .groupBy(post.authorId, user.name, user.email, user.image)
    .orderBy(desc(total), desc(post.authorId))

  return { data: rows }
})
