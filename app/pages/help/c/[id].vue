<script setup lang="ts">
import type { HelpCollectionIcon } from '#layers/feedlog/shared/constants/help'

interface CollectionPage {
  collection: { id: string; name: string; description: string | null; icon: HelpCollectionIcon }
  articles: { shortId: string; slug: string; title: string; description: string | null; updatedAt: string }[]
}

const route = useRoute()
const localePath = useLocalePath()

const { data, error } = await useFetch<CollectionPage>(`/api/help/collections/${route.params.id}`)

if (error.value) {
  throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: 'Not Found', fatal: true })
}

const collection = computed(() => data.value?.collection)
const articles = computed(() => data.value?.articles ?? [])

usePageOg({ kind: 'helpCollection', title: () => collection.value?.name, description: () => collection.value?.description })

const formatDate = useFormatDate()
</script>

<template>
  <div v-if="collection" class="flex-1 overflow-auto">
    <div class="mx-auto max-w-[768px] px-6 pb-16 pt-12">
      <NuxtLink :to="localePath('/help')" class="mb-4 inline-flex items-center gap-2 text-xs font-bold">
        <Icon name="lucide:arrow-left" size="16" />
        {{ $t('help.portal.back') }}
      </NuxtLink>

      <h1 class="text-[26px] font-bold leading-[34px]!">{{ collection.name }}</h1>
      <p v-if="collection.description" class="mt-1 text-sm text-muted-foreground">{{ collection.description }}</p>

      <div class="mt-6">
        <div v-if="!articles.length" class="px-6 pb-20 pt-14 text-center">
          <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Icon name="lucide:book-open" size="26" />
          </div>
          <p class="text-lg font-bold leading-[26px]">{{ $t('help.portal.collectionEmptyTitle') }}</p>
          <p class="mt-2 text-sm leading-[22px] text-muted-foreground">{{ $t('help.portal.collectionEmptyHint') }}</p>
        </div>

        <NuxtLink
          v-for="article in articles"
          :key="article.shortId"
          :to="localePath(`/help/${article.shortId}-${article.slug}`)"
          class="mb-3 block cursor-pointer rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div class="text-base font-bold leading-6">{{ article.title }}</div>
          <div v-if="article.description" class="mt-1 text-sm leading-[22px] text-muted-foreground">{{ article.description }}</div>
          <div class="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="lucide:clock" size="13" />
            {{ $t('help.portal.updated', { at: formatDate(article.updatedAt) }) }}
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
