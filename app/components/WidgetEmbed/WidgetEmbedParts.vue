<script setup lang="ts">
import WidgetEmbedImage from './WidgetEmbedImage.vue'
import type { Content } from '#layers/feedlog/shared/agent/content'
import { ArrowUpRight, BookOpen } from 'lucide-vue-next'
defineProps<{ content: Content; plainText?: boolean }>()
const emit = defineEmits<{ feedback: [slug: string]; article: [slug: string] }>()
</script>

<template>
  <div class="space-y-2">
    <template v-for="(part, index) in content.parts" :key="index">
      <p v-if="part.type === 'text' && plainText" class="whitespace-pre-wrap [overflow-wrap:anywhere]">{{ part.text }}</p>
      <WidgetEmbedMarkdown v-else-if="part.type === 'text'" :text="part.text" />
      <WidgetEmbedImage v-else-if="part.type === 'image'" :storage-key="part.storage_key" />
      <div v-else-if="part.type === 'article_reference'" class="space-y-1.5">
        <button v-for="article in part.articles" :key="article.article_id" :title="article.title" class="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-left text-[11.5px] font-semibold text-primary hover:border-primary/50" @click="emit('article', article.slug)">
          <BookOpen class="size-3.5 shrink-0" />
          <span class="min-w-0 flex-1 truncate">{{ article.title }}</span>
          <ArrowUpRight class="size-3 shrink-0" />
        </button>
      </div>
      <WidgetEmbedFeedbackCard v-else-if="'feedback_id' in part" :feedback="part" @open="emit('feedback', $event)" />
    </template>
  </div>
</template>
