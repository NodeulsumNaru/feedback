<script setup lang="ts">
import type { HelpCollectionIcon } from '#layers/feedlog/shared/constants/help'

interface PortalCollection {
  id: string
  name: string
  description: string | null
  icon: HelpCollectionIcon
  articleCount: number
}

const localePath = useLocalePath()

const { data, error } = await useFetch<{ data: PortalCollection[] }>('/api/help/collections')

if (error.value) {
  throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: 'Not Found', fatal: true })
}
const collections = computed(() => data.value?.data ?? [])

const query = ref('')

usePageOg({ kind: 'helpHome' })
</script>

<template>
  <div class="flex-1 overflow-auto">
    <div class="mx-auto max-w-[768px] px-6 pb-16 pt-12">
      <div class="text-center">
        <h1 class="text-[32px] font-extrabold leading-10! tracking-[-.02em]">{{ $t('help.portal.heading') }}</h1>
        <p v-if="collections.length" class="mt-2 text-[15px] text-muted-foreground">{{ $t('help.portal.subheading') }}</p>
      </div>

      <div v-if="!collections.length" class="px-6 pb-24 pt-[72px] text-center">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Icon name="lucide:book-open" size="26" />
        </div>
        <p class="text-lg font-bold leading-[26px]">{{ $t('help.portal.emptyTitle') }}</p>
        <p class="mt-2 text-sm leading-[22px] text-muted-foreground">{{ $t('help.portal.emptyHint') }}</p>
      </div>

      <template v-else>
        <div class="relative mt-7">
          <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Icon name="lucide:search" size="18" />
          </span>
          <input
            v-model="query"
            type="text"
            class="h-[52px] w-full rounded-2xl border border-border bg-card px-[46px] text-sm outline-none focus:border-primary focus:shadow-[0_4px_20px_rgba(196,90,70,.08)]"
            :placeholder="$t('help.portal.searchPlaceholder')"
          >
          <button v-if="query" type="button" class="absolute right-4 top-1/2 flex -translate-y-1/2 text-muted-foreground hover:text-foreground" @click="query = ''">
            <Icon name="lucide:x" size="16" />
          </button>
          <HelpSearchOverlay v-if="query.trim()" :query="query" />
        </div>

        <div class="mt-10 grid grid-cols-2 gap-4">
          <NuxtLink
            v-for="collection in collections"
            :key="collection.id"
            :to="localePath(`/help/c/${collection.id}`)"
            class="cursor-pointer rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div class="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-primary">
              <Icon :name="`lucide:${collection.icon}`" size="18" />
            </div>
            <div class="text-base font-bold leading-6">{{ collection.name }}</div>
            <div class="mt-1 text-[13px] leading-5 text-muted-foreground">{{ collection.description }}</div>
            <div class="mt-3.5 text-xs font-semibold text-muted-foreground">
              {{ $t('help.portal.articleCount', { n: collection.articleCount }, collection.articleCount) }}
            </div>
          </NuxtLink>
        </div>
      </template>
    </div>
  </div>
</template>
