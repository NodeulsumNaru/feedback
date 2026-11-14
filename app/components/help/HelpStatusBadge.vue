<script setup lang="ts">
import type { HelpArticleStatus } from '#layers/feedlog/shared/constants/help'

type HelpBadgeStatus = HelpArticleStatus | 'hidden'

const props = defineProps<{ status: HelpBadgeStatus }>()

const NEUTRAL = 'text-[var(--status-open)] bg-[var(--status-open-bg)] border-[var(--status-open-border)]'

const TONES: Record<HelpBadgeStatus, string> = {
  published: 'text-[var(--status-done)] bg-[var(--status-done-bg)] border-[var(--status-done-border)]',
  draft: NEUTRAL,
  archived: 'text-[var(--status-archived)] bg-[var(--status-archived-bg)] border-[var(--status-archived-border)]',
  hidden: NEUTRAL,
}

const tone = computed(() => TONES[props.status] ?? TONES.draft)
</script>

<template>
  <span class="inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[10px] font-bold leading-[15px]" :class="tone">
    {{ $t(`help.admin.status.${status}`) }}
  </span>
</template>
