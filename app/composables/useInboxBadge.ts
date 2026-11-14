export function useInboxBadge() {
  const org = useOrgContext()
  const activity = useState<Record<string, Record<string, number>>>('inbox-open-activity', () => ({}))
  const positions = useState<Record<string, Record<string, number>>>('inbox-local-read-positions', () => ({}))
  const revisions = useState<Record<string, number>>('inbox-summary-revisions', () => ({}))
  const storageKey = (orgId: string) => `feedlog:inbox:read:${orgId}`
  function loadPositions(orgId: string, raw?: string | null) {
    if (!import.meta.client) return
    try {
      const saved: unknown = JSON.parse(raw === undefined ? localStorage.getItem(storageKey(orgId)) ?? '{}' : raw ?? '{}')
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return
      const next = { ...positions.value[orgId] }
      for (const [id, seq] of Object.entries(saved)) {
        if (typeof seq === 'number' && Number.isSafeInteger(seq) && seq >= 0) next[id] = Math.max(next[id] ?? 0, seq)
      }
      positions.value[orgId] = next
    } catch {
      /* Unavailable or invalid storage falls back to this page's memory. */
    }
  }
  function isUnread(id: string) {
    const orgId = org.value.orgId
    return (activity.value[orgId]?.[id] ?? 0) > (positions.value[orgId]?.[id] ?? 0)
  }
  const count = computed(() => Object.keys(activity.value[org.value.orgId] ?? {}).filter(isUnread).length)
  function markRead(id: string, observedSeq: number) {
    if (!Number.isSafeInteger(observedSeq) || observedSeq <= 0) return
    const orgId = org.value.orgId
    loadPositions(orgId)
    if (observedSeq <= (positions.value[orgId]?.[id] ?? 0)) return
    positions.value[orgId] = { ...positions.value[orgId], [id]: observedSeq }
    try { localStorage.setItem(storageKey(orgId), JSON.stringify(positions.value[orgId])) }
    catch { /* The read position still applies until this page is refreshed. */ }
  }
  async function refresh() {
    const orgId = org.value.orgId
    loadPositions(orgId)
    const revision = (revisions.value[orgId] ?? 0) + 1
    revisions.value[orgId] = revision
    try {
      const result = await useApiFetch<{ openConversations: { id: string; attentionSeq: number }[] }>('/api/admin/inbox/summary')
      if (revisions.value[orgId] === revision) activity.value[orgId] = Object.fromEntries(result.openConversations.map(row => [row.id, row.attentionSeq]))
    } catch {
      /* Navigation remains available if polling fails. */
    }
  }
  function onStorage(event: StorageEvent) {
    if (event.key === storageKey(org.value.orgId)) loadPositions(org.value.orgId, event.newValue)
  }
  onMounted(() => { loadPositions(org.value.orgId); window.addEventListener('storage', onStorage) })
  onBeforeUnmount(() => window.removeEventListener('storage', onStorage))
  return { count, refresh, isUnread, markRead }
}
