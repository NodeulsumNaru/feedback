// Best-effort fixed-window limiter over Nitro storage. Scope depends on the
// mounted storage driver; read/write increments are not atomic. Returns
// true if the caller is WITHIN the limit, false once the window is exhausted.
export async function checkRateLimit(
  key: string,
  opts: { limit: number; windowSeconds: number; failClosed?: boolean },
): Promise<boolean> {
  try {
    const storage = useStorage('ratelimit')
    const windowMs = opts.windowSeconds * 1000
    const bucket = Math.floor(Date.now() / windowMs)
    const storeKey = `${key}:${bucket}`
    const count = ((await storage.getItem<number>(storeKey)) ?? 0) + 1
    // ttl lets KV-style drivers GC old buckets; memory driver ignores it (fine in dev).
    await storage.setItem(storeKey, count, { ttl: opts.windowSeconds + 5 })
    return count <= opts.limit
  }
  catch {
    // Search stays available when the counter store errors. Callers that must
    // not run without a counter pass failClosed.
    return !opts.failClosed
  }
}
