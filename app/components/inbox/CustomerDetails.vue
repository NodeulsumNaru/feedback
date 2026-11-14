<script setup lang="ts">
import type { InboxCustomer, InboxConversation } from '#layers/feedlog/shared/inbox/types'
defineProps<{
  customer: InboxCustomer
  conversation: InboxConversation
  feedbacks: { id: string; slug: string; title: string; status: string }[]
  busy: boolean
  hasMore: boolean
}>()
const emit = defineEmits<{ priority: [value: string]; feedback: [slug: string]; more: [] }>()
const { t } = useI18n()
const { authorName } = useAuthorDisplay()
</script>

<template>
  <div class="divide-y divide-border px-5" data-inbox-customer>
    <section class="py-5">
      <h3 class="mb-5 text-xs font-semibold text-foreground">{{ t('inbox.customerDetails') }}</h3>
      <div class="flex min-w-0 items-center gap-3 pb-5 text-left">
        <UserAvatar :author="customer" :size="10" />
        <p class="min-w-0 flex-1 truncate text-sm font-semibold" :title="authorName(customer)">{{ authorName(customer) }}</p>
      </div>
      <div class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Icon name="lucide:mail" size="14" class="shrink-0" />
        <a v-if="customer.email" :href="`mailto:${customer.email}`" :title="customer.email" class="min-w-0 break-all hover:text-primary">{{ customer.email }}</a>
        <span v-else>{{ t('inbox.noEmail') }}</span>
      </div>
    </section>
    <section class="space-y-3 py-5">
      <h3 class="text-xs font-semibold">{{ t('inbox.properties') }}</h3>
      <div class="flex items-center justify-between gap-3">
        <span class="flex items-center gap-2 text-xs text-muted-foreground"><Icon name="lucide:flag" size="14" />{{ t('inbox.priority') }}</span>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button type="button" class="grid h-8 w-[100px] shrink-0 grid-cols-[1fr_auto] cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-xs font-bold text-primary transition-colors hover:bg-background/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" :disabled="busy" :aria-label="t('inbox.priority')">
              <span class="whitespace-nowrap">{{ t(`inbox.${conversation.priority}`) }}</span>
              <Icon name="lucide:chevron-down" size="14" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-(--reka-dropdown-menu-trigger-width) min-w-0">
            <FilterOptionItem class="justify-start text-left" :selected="conversation.priority === 'normal'" @select="emit('priority', 'normal')">{{ t('inbox.normal') }}</FilterOptionItem>
            <FilterOptionItem class="justify-start text-left" :selected="conversation.priority === 'high'" @select="emit('priority', 'high')">{{ t('inbox.high') }}</FilterOptionItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </section>
    <section class="space-y-3 py-5">
      <h3 class="text-xs font-semibold">{{ t('inbox.feedback') }}</h3>
      <p v-if="!feedbacks.length" class="text-xs text-muted-foreground">{{ t('inbox.noFeedback') }}</p>
      <button
        v-for="post in feedbacks" :key="post.id"
        class="group block w-full space-y-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        :aria-label="post.title" @click="emit('feedback', post.slug)"
      >
        <span class="flex items-start gap-2">
          <span class="min-w-0 flex-1 break-words text-xs font-semibold leading-relaxed">{{ post.title }}</span>
          <Icon name="lucide:arrow-up-right" size="16" class="mt-0.5 shrink-0 text-primary" />
        </span>
        <WidgetEmbedStatusBadge :status="post.status" />
      </button>
      <Button v-if="hasMore" variant="ghost" size="sm" class="w-full text-xs" @click="emit('more')">{{ t('inbox.loadMore') }}</Button>
    </section>
  </div>
</template>
