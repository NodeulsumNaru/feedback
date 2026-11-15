import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { consola } from 'consola'
import { AsyncLocalStorage } from 'node:async_hooks'
import * as schema from '#layers/feedlog/server/db/schemas/index'

const logger = consola.withTag('db')

type DB = ReturnType<typeof drizzle>

let _db: DB | null = null

const isCF = import.meta.preset === 'cloudflare-module' || import.meta.preset === 'cloudflare-pages'

// Map undefined bind params to NULL. Without this, an undefined param (e.g. a
// missing orgId on a non-tenant host) makes postgres-js throw UNDEFINED_VALUE
// mid-pipeline, which corrupts the connection (left stuck active/ClientRead)
// and, under concurrency, exhausts the whole pool — a full outage that only a
// restart clears. Turning undefined into NULL keeps the query harmless.
const transform = { undefined: null }

function createCfDb(): DB {
  const g = globalThis as { __env__?: { POSTGRES?: { connectionString: string } }, POSTGRES?: { connectionString: string } }
  const binding = g.__env__?.POSTGRES || g.POSTGRES
  if (!binding) throw new Error('POSTGRES Hyperdrive binding not found')
  return drizzle(postgres(binding.connectionString, {
    prepare: true,
    transform,
    // A Worker invocation may hold at most 6 open sockets (Hyperdrive, fetch,
    // the agent pg pools…). Keep this client well under that.
    max: 4,
    // Close idle sockets on their own instead of an explicit end(): work that
    // outlives the response (event.waitUntil) may still query, and postgres-js
    // simply reconnects if it does.
    idle_timeout: 5,
  }), { schema })
}

// One scope per incoming Worker request (see server/plugins/db-request-scope.ts).
// Internal SSR calls ($fetch('/api/…') during render) run inside the outer
// request's async flow, so they see the same scope and share its client.
const requestScope = new AsyncLocalStorage<{ db?: DB }>()

export function runInDbRequestScope<T>(fn: () => T): T {
  return requestScope.getStore() ? fn() : requestScope.run({}, fn)
}

function getDb(): DB {
  // CF Workers: Hyperdrive sockets belong to one invocation, so a client can't
  // be shared across requests — but it must be shared *within* one. This used
  // to build a new client (and a new connection) on every `db.x` access, i.e.
  // per query, never closing any of them. Pages with more than a handful of
  // queries then queued behind the per-invocation socket limit and stalled
  // (CONNECT_TIMEOUT). Now: one client per incoming request.
  if (isCF) {
    const scope = requestScope.getStore()
    if (!scope) return createCfDb() // no request (cron/queue/startup): one-off client
    return (scope.db ??= createCfDb())
  }

  // Node.js (Docker/Vercel): singleton — persistent process, connection pool is long-lived
  if (!_db) {
    _db = drizzle(postgres(process.env.DATABASE_URL!, {
      transform,
      onnotice: notice => logger.info(`[DB Notice] ${notice.message}`),
    }), { schema })
  }
  return _db
}

export const db = new Proxy({} as DB, {
  get(_, prop) { return getDb()[prop as keyof DB] },
})
