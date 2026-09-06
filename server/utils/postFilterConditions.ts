import { and, eq, gte, inArray, isNotNull, isNull, lt, notInArray, or, type SQL } from 'drizzle-orm'
import { post } from '#layers/feedlog/server/db/schemas'

// Filter conditions shared by the three post query paths: the admin list, the
// keyword-search fallback, and the semantic search.

const NO_BOARD = 'none'

export interface PostFilter {
  orgId: string
  status?: string[]
  statusNot?: string[]
  boardId?: string[]
  boardIdNot?: string[]
  authorId?: string[]
  authorIdNot?: string[]
  createdFrom?: Date
  createdTo?: Date
  merged?: 'canonical_only' | 'merged_only' | 'all'
}

function list(v: unknown): string[] | undefined {
  if (typeof v !== 'string') return undefined
  const items = v.split(',').map(s => s.trim()).filter(Boolean)
  return items.length ? items : undefined
}

function date(v: unknown): Date | undefined {
  if (typeof v !== 'string' || !v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export function parsePostFilter(query: Record<string, unknown>, orgId: string): PostFilter {
  const statusNot = list(query['status!'])
  const boardIdNot = list(query['boardId!'])
  const authorIdNot = list(query['author!'])

  return {
    orgId,
    status: statusNot ? undefined : list(query.status),
    statusNot,
    boardId: boardIdNot ? undefined : list(query.boardId),
    boardIdNot,
    authorId: authorIdNot ? undefined : list(query.author),
    authorIdNot,
    createdFrom: date(query.createdFrom),
    createdTo: date(query.createdTo),
    merged: query.merged === 'merged_only' || query.merged === 'all' ? query.merged : 'canonical_only',
  }
}

// board_id is nullable, so a negation has to name NULL explicitly — SQL's
// NOT IN drops NULL rows, which would hide every unclassified post.
function boardCondition(f: PostFilter): SQL | undefined {
  if (f.boardId?.length) {
    const ids = f.boardId.filter(v => v !== NO_BOARD)
    if (!ids.length) return isNull(post.boardId)
    return ids.length === f.boardId.length
      ? inArray(post.boardId, ids)
      : or(inArray(post.boardId, ids), isNull(post.boardId))
  }

  if (f.boardIdNot?.length) {
    const ids = f.boardIdNot.filter(v => v !== NO_BOARD)
    if (!ids.length) return isNotNull(post.boardId)
    return ids.length === f.boardIdNot.length
      ? or(isNull(post.boardId), notInArray(post.boardId, ids))
      : and(isNotNull(post.boardId), notInArray(post.boardId, ids))
  }
}

export function postFilterConditions(f: PostFilter): SQL[] {
  const conditions: SQL[] = [eq(post.orgId, f.orgId)]

  if (f.merged === 'merged_only') conditions.push(isNotNull(post.mergedTo))
  else if (f.merged !== 'all') conditions.push(isNull(post.mergedTo))

  if (f.status?.length) conditions.push(inArray(post.status, f.status))
  if (f.statusNot?.length) conditions.push(notInArray(post.status, f.statusNot))

  const board = boardCondition(f)
  if (board) conditions.push(board)

  if (f.authorId?.length) conditions.push(inArray(post.authorId, f.authorId))
  if (f.authorIdNot?.length) conditions.push(notInArray(post.authorId, f.authorIdNot))

  if (f.createdFrom) conditions.push(gte(post.createdAt, f.createdFrom))
  if (f.createdTo) conditions.push(lt(post.createdAt, f.createdTo))

  return conditions
}
