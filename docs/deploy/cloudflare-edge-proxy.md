# Two-host deployment: Vercel app + Cloudflare edge proxy

Use this when you want to stay on **free plans** and keep **server-side rendering
(SEO)**.

Workers Free allows about **10 ms of CPU per request**. A Nuxt SSR render (plus
the first request's module loading) takes tens of milliseconds, so running the
whole app on a free Worker ends in `Worker exceeded CPU time limit` (503).

Waiting on `fetch()` costs no CPU, so a Worker that only *forwards* requests fits
easily. This setup therefore splits the work:

```
browser ──► Cloudflare Worker "feedback" (Free)        ──►  Vercel (Hobby, free)
            deploy/cloudflare-edge-proxy                    the full Nuxt app:
            · keeps the public *.workers.dev address        SSR, API, auth, AI,
            · caches /_nuxt/* at the edge                    cron, queues
            · ~1 ms CPU per request                      ──►  Postgres (Neon)
```

The app adopts the public host only for requests that carry the shared secret
(`server/plugins/00.edge-proxy-host.ts`), so auth trusted origins, cookies,
canonical URLs, sitemaps and e-mail links all use the public address. Direct hits
on `*.vercel.app` still work (Vercel cron and queue callbacks use them) but are
marked `X-Robots-Tag: noindex`.

> Vercel Hobby is for personal, non-commercial use. It includes 4 h of active CPU,
> daily cron jobs and 1M Queue operations per month.

## 1. Deploy the app to Vercel

Follow [vercel.md](./vercel.md) (import the repo, keep the `pnpm build:vercel`
build command, which runs migrations on every deploy). Environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string (the same database Hyperdrive pointed at) |
| `BETTER_AUTH_SECRET` | same value as before, or existing sessions are signed out |
| `BETTER_AUTH_URL` | the **public** address, e.g. `https://feedback.<you>.workers.dev` |
| `NUXT_SITE_URL` | the same public address (pins canonical URLs and sitemaps) |
| `SYSTEM_ADMIN_EMAILS` | as before |
| `EDGE_PROXY_SECRET` | a new random string: `openssl rand -hex 32` |

Plus any optional keys you already use (OpenAI, Resend, OAuth, …). OAuth apps'
callback URLs stay on the public address.

Tip: in Vercel → Settings → Functions, set the function region close to your
Neon region; every query crosses that link.

Note the production URL (e.g. `https://feedback-xyz.vercel.app`).

## 2. Point the edge proxy at Vercel

1. Edit `deploy/cloudflare-edge-proxy/wrangler.toml` and set
   `ORIGIN = "https://feedback-xyz.vercel.app"`.
2. Store the shared secret on the Worker (same value as on Vercel):

   ```bash
   npx wrangler secret put EDGE_PROXY_SECRET -c deploy/cloudflare-edge-proxy/wrangler.toml
   ```

## 3. Switch Cloudflare Workers Builds to the proxy

Cloudflare dashboard → Workers → `feedback` → Settings → Build:

| Setting | Value |
|---|---|
| Build command | *(empty)* |
| Deploy command | `npx wrangler deploy -c deploy/cloudflare-edge-proxy/wrangler.toml` |

The proxy is deployed under the same Worker name, so the public address doesn't
change. Its config has no Hyperdrive, Queue or cron bindings: that work now
happens on Vercel.

Always pass `-c …/wrangler.toml` explicitly. A leftover
`.wrangler/deploy/config.json` from a full Cloudflare build would otherwise take
precedence.

## Local test

```bash
# terminal 1 – the app (node preset), told to trust the proxy
EDGE_PROXY_SECRET=dev NUXT_SITE_URL=http://localhost:8799 \
BETTER_AUTH_URL=http://localhost:8799 node .output/server/index.mjs

# terminal 2 – the proxy
npx wrangler dev -c deploy/cloudflare-edge-proxy/wrangler.toml --port 8799 \
  --var ORIGIN:http://localhost:3000 --var EDGE_PROXY_SECRET:dev
```
