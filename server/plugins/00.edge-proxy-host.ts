import { timingSafeEqual } from 'node:crypto'

// "Two-host" deployment (docs/deploy/cloudflare-edge-proxy.md): a tiny Cloudflare
// Worker on the public address forwards every request to this app on Vercel.
// Vercel then sees its own *.vercel.app Host, but auth trusted origins, cookies and
// every link we build from getRequestURL() must use the public address.
//
// When the request carries the shared secret, adopt the proxy's x-forwarded-host as
// the Host. Without the secret, never trust forwarded headers (anyone could spoof
// the Host and get password-reset or notification links pointing elsewhere).
//
// Named 00.* so its `request` hook runs before every other plugin's.
export default defineNitroPlugin((nitroApp) => {
  const secret = process.env.EDGE_PROXY_SECRET
  if (!secret) return
  const expected = Buffer.from(secret)

  nitroApp.hooks.hook('request', (event) => {
    const headers = event.node.req.headers
    const given = headers['x-feedback-proxy-secret']
    delete headers['x-feedback-proxy-secret']
    const ok = typeof given === 'string'
      && given.length === secret.length
      && timingSafeEqual(Buffer.from(given), expected)

    if (ok) {
      const host = String(headers['x-forwarded-host'] ?? '').split(',')[0]?.trim()
      if (host) headers.host = host
      // the proxy sets this from the public URL; default to https if missing
      const proto = String(headers['x-forwarded-proto'] ?? '').split(',')[0]?.trim()
      headers['x-forwarded-proto'] = proto === 'http' ? 'http' : 'https'
      // h3 caches normalized headers on first access; make sure it re-reads them
      ;(event as unknown as { _headers?: unknown })._headers = undefined
      return
    }

    // Direct hit on the origin (*.vercel.app): keep it working — Vercel cron and
    // queue callbacks arrive this way — but keep the duplicate host out of search.
    event.context.edgeProxyDirectHit = true
  })

  // Set late: the SEO module writes its own X-Robots-Tag during rendering.
  nitroApp.hooks.hook('beforeResponse', (event) => {
    if (event.context.edgeProxyDirectHit && !event.node.res.headersSent)
      event.node.res.setHeader('x-robots-tag', 'noindex, nofollow')
  })
})
