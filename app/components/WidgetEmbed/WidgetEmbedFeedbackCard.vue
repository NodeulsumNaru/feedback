<script setup lang="ts">
import type { FeedbackPart } from '#layers/feedlog/shared/agent/content'

defineProps<{ feedback: FeedbackPart }>()
defineEmits<{ open: [slug: string] }>()

const actionIcons: Record<FeedbackPart['type'], string> = {
  feedback_created: 'lucide:circle-plus',
  feedback_updated: 'lucide:pencil',
  feedback_upvoted: 'lucide:chevron-up',
  feedback_comment_added: 'lucide:message-square',
  feedback_comment_updated: 'lucide:message-square-diff',
}
</script>

<template>
  <div class="w-full min-w-[min(230px,100%)] rounded-md border border-border bg-background p-2.5 text-left text-foreground transition-colors hover:border-primary/50">
    <button class="block w-full text-left" :aria-label="`${feedback.title} — ${$t('widget.viewOnBoard')}`" @click="$emit('open', feedback.slug)">
      <span class="flex items-start gap-2.5">
        <span class="flex w-9 shrink-0 flex-col items-center rounded-md border py-1 text-primary" :class="feedback.has_voted ? 'border-primary/20 bg-secondary' : 'border-border'">
          <Icon name="lucide:chevron-up" size="14" />
          <span class="text-[13px] font-semibold leading-5">{{ feedback.vote_count }}</span>
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-start gap-1"><span class="min-w-0 flex-1 text-[13px] font-semibold leading-snug">{{ feedback.title }}</span><Icon name="lucide:arrow-up-right" size="12" class="mt-0.5 shrink-0 text-muted-foreground" /></span>
          <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span v-if="feedback.board_name" class="rounded-sm bg-secondary px-1.5 py-0.5 text-[10.5px] font-semibold text-primary">{{ feedback.board_name }}</span>
            <span v-if="feedback.status_id" class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10.5px] font-medium leading-4">
              <span class="size-1.5 rounded-full" :style="{ backgroundColor: `var(--status-${feedback.status_id.replace('_', '-')})` }" aria-hidden="true" />
              <span :class="feedback.status_id === 'open' ? 'text-muted-foreground' : ''" :style="feedback.status_id !== 'open' ? { color: `var(--status-${feedback.status_id.replace('_', '-')})` } : {}">{{ $t(`status.${feedback.status_id}`) }}</span>
            </span>
          </span>
        </span>
      </span>
      <span class="mt-2 block border-t border-border pt-2">
        <span class="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground"><Icon :name="actionIcons[feedback.type]" size="12" />{{ $t(`widget.actions.${feedback.type}`) }}</span>
      </span>
    </button>
    <div v-if="'comment_text' in feedback" class="mt-1 text-[12px] leading-normal"><WidgetEmbedMarkdown :text="feedback.comment_text" /></div>
  </div>
</template>
