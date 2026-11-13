<script setup lang="ts">
import { ArrowLeft, ArrowUpRight } from 'lucide-vue-next'
import { widgetEmbedKey } from '#layers/feedlog/app/composables/useWidgetEmbed'
import '#layers/feedlog/app/assets/css/help-article.css'
const props = defineProps<{ slug: string; productName: string; initialScrollTop?: number }>()
const emit = defineEmits<{ close: []; article: [slug: string]; scroll: [top: number] }>()
const { widgetFetch } = inject(widgetEmbedKey)!
const article = ref<{
  title: string; description: string | null; content: string
  shortId: string; canonicalSlug: string; collection: { id: string; name: string }
} | null>(null)
const loading = ref(false)
const failed = ref(false)
const bodyEl = ref<HTMLElement | null>(null)
const articlePath = computed(() => `/help/${article.value ? `${article.value.shortId}-${article.value.canonicalSlug}` : props.slug}`)
let request = 0
function followLink(event: MouseEvent) {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]')
  if (!link) return
  const target = new URL(link.href, window.location.origin)
  const match = target.pathname.match(/^\/help\/([a-zA-Z0-9]{6}-.+)$/)
  if (target.origin === window.location.origin && match) {
    event.preventDefault()
    emit('article', match[1]!)
  } else if (['http:', 'https:'].includes(target.protocol)) {
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
  }
}
watch(() => props.slug, async slug => {
  const version = ++request
  loading.value = true
  failed.value = false
  bodyEl.value?.scrollTo({ top: 0 })
  try {
    const result = await widgetFetch<NonNullable<typeof article.value>>(`/api/help/articles/${encodeURIComponent(slug.split('-')[0]!)}`)
    if (version === request) article.value = result
  } catch { if (version === request) failed.value = true }
  finally {
    if (version === request) {
      loading.value = false
      await nextTick()
      await document.fonts.ready
      if (version === request && bodyEl.value) bodyEl.value.scrollTop = props.initialScrollTop ?? 0
    }
  }
}, { immediate: true })
</script>

<template>
  <section class="absolute inset-0 z-10 flex min-h-0 flex-col bg-card" :aria-label="$t('widget.helpCenter')">
    <header class="flex shrink-0 items-center gap-2 border-b p-3">
      <Button variant="subtle" size="icon-sm" :aria-label="$t('widget.backToChat')" @click="emit('close')"><ArrowLeft class="size-4" /></Button>
      <span class="text-sm font-medium">{{ $t('widget.helpCenter') }}</span>
    </header>
    <div ref="bodyEl" class="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-5 [overflow-wrap:anywhere]" @scroll="emit('scroll', bodyEl?.scrollTop ?? 0)">
      <Icon v-if="loading" name="lucide:loader-2" size="20" class="animate-spin" />
      <p v-else-if="failed" class="text-sm text-muted-foreground">{{ $t('widget.articleUnavailable') }}</p>
      <template v-else-if="article">
        <p class="text-[10px] text-muted-foreground">{{ $t('widget.productHelp', { product: productName }) }} / {{ article.collection.name }}</p>
        <div class="mt-4 flex items-start gap-2">
          <h1 class="min-w-0 flex-1 text-xl font-semibold">{{ article.title }}</h1>
          <a :href="articlePath" target="_blank" rel="noopener noreferrer" class="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary" :aria-label="$t('widget.openArticle')" :title="$t('widget.openArticle')"><ArrowUpRight class="size-4" /></a>
        </div>
        <p v-if="article.description" class="mt-2 text-sm leading-6 text-muted-foreground">{{ article.description }}</p>
        <div class="help-article-styled widget-article mt-5 border-t pt-4" @click.capture="followLink"><WidgetEmbedMarkdown :text="article.content" variant="article" /></div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.widget-article :deep(.md-editor-preview-wrapper) { padding: 0; }
.widget-article :deep(.md-editor-preview) { font-size: 13px; line-height: 1.7; }
.widget-article :deep(h2) { font-size: 17px; }
.widget-article :deep(h3) { font-size: 14px; }
.widget-article :deep(table) { font-size: 12px; }
</style>
