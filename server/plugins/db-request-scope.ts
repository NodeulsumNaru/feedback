import { runInDbRequestScope } from '../db'

// Cloudflare: give every unit of work one DB client scope (server/db/index.ts).
// - fetch: h3's listener reads `h3App.handler` on each call, so wrapping it here
//   also covers internal $fetch calls, which reuse the outer request's scope.
// - queue / scheduled / email: Nitro's Worker entry runs these through
//   `cloudflare:*` hooks, so wrap those calls too; otherwise every `db.x` access
//   inside a queue consumer would open (and leak) its own connection.
export default defineNitroPlugin((nitroApp) => {
  if (import.meta.preset !== 'cloudflare-module' && import.meta.preset !== 'cloudflare-pages') return
  const handler = nitroApp.h3App.handler
  nitroApp.h3App.handler = event => runInDbRequestScope(() => handler(event))

  const callHook = nitroApp.hooks.callHook.bind(nitroApp.hooks)
  nitroApp.hooks.callHook = ((name: string, ...args: unknown[]) =>
    name.startsWith('cloudflare:')
      ? runInDbRequestScope(() => (callHook as (n: string, ...a: unknown[]) => Promise<unknown>)(name, ...args))
      : (callHook as (n: string, ...a: unknown[]) => Promise<unknown>)(name, ...args)) as typeof nitroApp.hooks.callHook
})
