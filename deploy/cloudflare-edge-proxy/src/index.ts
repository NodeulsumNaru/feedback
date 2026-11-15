/**
 * Thin reverse proxy: public Cloudflare address → app on Vercel.
 *
 * Why: Workers Free allows ~10 ms CPU per request, which Nuxt SSR cannot fit in.
 * Waiting on fetch() costs no CPU, so forwarding fits easily, and the heavy work
 * (SSR, API, AI) runs on Vercel where CPU isn't capped per request.
 *
 * - Adds x-forwarded-host + a shared secret so the app adopts the public host
 *   (server/plugins/00.edge-proxy-host.ts) for auth origins, cookies and links.
 * - Caches immutable build assets (/_nuxt/*) at the edge.
 * - Rewrites absolute redirects that point at the origin back to the public host.
 */
interface Env {
  ORIGIN: string
  EDGE_PROXY_SECRET: string
}

const IMMUTABLE_PREFIXES = ['/_nuxt/', '/_fonts/']

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (!env.EDGE_PROXY_SECRET || !env.ORIGIN || env.ORIGIN.includes('CHANGE-ME'))
      return new Response('Edge proxy is not configured (ORIGIN / EDGE_PROXY_SECRET).', { status: 500 })

    const url = new URL(request.url)
    const origin = new URL(env.ORIGIN)
    const target = new URL(url.pathname + url.search, origin)

    const cacheable = request.method === 'GET' && IMMUTABLE_PREFIXES.some(p => url.pathname.startsWith(p))
    const cache = caches.default
    if (cacheable) {
      const hit = await cache.match(request)
      if (hit) return hit
    }

    const headers = new Headers(request.headers)
    headers.set('x-forwarded-host', url.host)
    headers.set('x-forwarded-proto', url.protocol.replace(':', ''))
    headers.set('x-feedback-proxy-secret', env.EDGE_PROXY_SECRET)
    const ip = request.headers.get('cf-connecting-ip')
    if (ip) headers.set('x-forwarded-for', ip)

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    })

    let response = new Response(upstream.body, upstream)
    const location = response.headers.get('location')
    if (location) {
      const loc = new URL(location, target)
      if (loc.host === origin.host) {
        loc.protocol = url.protocol
        loc.host = url.host
        response.headers.set('location', loc.toString())
      }
    }

    if (cacheable && upstream.ok && /immutable|max-age=\d{4,}/.test(upstream.headers.get('cache-control') ?? '')) {
      response = new Response(response.body, response)
      ctx.waitUntil(cache.put(request, response.clone()))
    }
    return response
  },
}
