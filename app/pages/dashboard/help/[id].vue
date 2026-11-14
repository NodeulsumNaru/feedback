<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'admin' })

const route = useRoute()
const articleId = computed(() => route.params.id as string)
</script>

<template>
  <HelpArticleEditor :article-id="articleId" />
</template>
