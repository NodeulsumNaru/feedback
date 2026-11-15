// Operator key for confirming upgrade migrations without signing in.
//
// Signing in is not always possible while migrations are pending: every page
// redirects to /setup, and better-auth may query columns a pending migration
// has yet to add (e.g. user.is_anonymous), so "sign in, then come back" can be
// a dead end. The operator who deployed the Worker already holds its secrets,
// so knowing one of them is proof enough. SETUP_TOKEN takes precedence; if it
// is unset, BETTER_AUTH_SECRET (required for every deploy) is accepted.
export function expectedSetupKey(): string | undefined {
  return process.env.SETUP_TOKEN || process.env.BETTER_AUTH_SECRET || undefined
}

export function setupKeyMatches(provided: string | null | undefined): boolean {
  const expected = expectedSetupKey()
  if (!expected || !provided) return false
  // Constant-time comparison so response timing does not leak the key.
  const a = new TextEncoder().encode(provided)
  const b = new TextEncoder().encode(expected)
  let diff = a.length ^ b.length
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i]!
  return diff === 0
}
