<script setup lang="ts">
import type { InboxStatus } from '#layers/feedlog/shared/inbox/state'
const props = defineProps<{ status: InboxStatus }>()
const colours: Record<InboxStatus, string> = {
  open: 'in-progress', pending: 'in-progress', snoozed: 'planned', closed: 'done', ai_handling: 'open',
}
const colour = computed(() => `--status-${colours[props.status]}`)
const icons: Record<InboxStatus, string> = {
  open: 'lucide:inbox', pending: 'lucide:hourglass', snoozed: 'lucide:clock', closed: 'lucide:check-check', ai_handling: 'lucide:bot',
}
</script>
<template>
  <Badge variant="outline" class="gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium" :style="{ color: `var(${colour})`, backgroundColor: `var(${colour}-bg)`, borderColor: `var(${colour}-border)` }">
    <Icon :name="icons[status]" size="11" /><span>{{ $t(`inbox.statuses.${status}`) }}</span>
  </Badge>
</template>
