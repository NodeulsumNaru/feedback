// The one copy of the admin feedback filter conditions: the chip bar, the
// quick-filter rail and the address bar all read and write this shape.

export type EnumFilterField = 'status' | 'boardId' | 'author'

export type FilterCondition =
  | { field: EnumFilterField, op: 'is' | 'not', values: string[] }
  | { field: 'created', op: 'before' | 'after' | 'range', from?: string, to?: string }
  | { field: 'merged', value: string }

const ENUM_FIELDS: EnumFilterField[] = ['status', 'boardId', 'author']

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

function list(v: unknown): string[] | undefined {
  const s = str(v)
  if (!s) return undefined
  const items = s.split(',').map(x => x.trim()).filter(Boolean)
  return items.length ? items : undefined
}

export function parseFilterQuery(query: Record<string, unknown>): FilterCondition[] {
  const conditions: FilterCondition[] = []

  for (const field of ENUM_FIELDS) {
    const not = list(query[`${field}!`])
    if (not) conditions.push({ field, op: 'not', values: not })
    else {
      const is = list(query[field])
      if (is) conditions.push({ field, op: 'is', values: is })
    }
  }

  const from = str(query.createdFrom)
  const to = str(query.createdTo)
  if (from || to) {
    conditions.push({ field: 'created', op: from && to ? 'range' : from ? 'after' : 'before', from, to })
  }

  const merged = str(query.merged)
  if (merged && merged !== 'canonical_only') conditions.push({ field: 'merged', value: merged })

  return conditions
}

// Hand-rolled instead of URLSearchParams, which percent-encodes the `!` in a
// parameter name and leaves `status%21=open` in the address bar.
export function serializeFilterQuery(
  conditions: FilterCondition[],
  extra: { q?: string, sort?: string, order?: string, page?: number } = {},
): string {
  const parts: string[] = []

  if (extra.q) parts.push(`q=${encodeURIComponent(extra.q)}`)

  for (const c of conditions) {
    if (c.field === 'created') {
      if (c.op !== 'before' && c.from) parts.push(`createdFrom=${c.from}`)
      if (c.op !== 'after' && c.to) parts.push(`createdTo=${c.to}`)
    }
    else if (c.field === 'merged') {
      if (c.value !== 'canonical_only') parts.push(`merged=${c.value}`)
    }
    else if (c.values.length) {
      parts.push(`${c.field}${c.op === 'not' ? '!' : ''}=${c.values.map(encodeURIComponent).join(',')}`)
    }
  }

  if (extra.sort && extra.sort !== 'createdAt') parts.push(`sort=${extra.sort}`)
  if (extra.order === 'asc') parts.push('order=asc')
  if (extra.page && extra.page > 1) parts.push(`page=${extra.page}`)

  return parts.join('&')
}

// `to` is exclusive: the boundary is the day after, in the browser's timezone.
function dayBoundary(date: string, plusDays = 0): string | undefined {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d + plusDays).toISOString()
}

export function filterApiQuery(
  conditions: FilterCondition[],
  extra: { q?: string, sort?: string, order?: string, page?: number, pageSize?: number } = {},
): Record<string, string | number | undefined> {
  const query: Record<string, string | number | undefined> = { merged: 'canonical_only', ...extra }

  for (const c of conditions) {
    if (c.field === 'created') {
      if (c.op !== 'before' && c.from) query.createdFrom = dayBoundary(c.from)
      if (c.op !== 'after' && c.to) query.createdTo = dayBoundary(c.to, 1)
    }
    else if (c.field === 'merged') {
      query.merged = c.value
    }
    else if (c.values.length) {
      query[`${c.field}${c.op === 'not' ? '!' : ''}`] = c.values.join(',')
    }
  }

  return query
}

export function findCondition(conditions: FilterCondition[], field: string): FilterCondition | undefined {
  return conditions.find(c => c.field === field)
}

export function railValue(conditions: FilterCondition[], field: EnumFilterField): string | null {
  const c = findCondition(conditions, field)
  if (!c || c.field === 'created' || c.field === 'merged') return null
  return c.op === 'is' && c.values.length === 1 ? c.values[0]! : null
}

export function toggleRail(
  conditions: FilterCondition[],
  field: EnumFilterField,
  value: string,
): FilterCondition[] {
  if (railValue(conditions, field) === value) return conditions.filter(c => c.field !== field)
  return [...conditions.filter(c => c.field !== field), { field, op: 'is', values: [value] }]
}
