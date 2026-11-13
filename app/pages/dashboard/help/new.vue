<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'admin' })

const route = useRoute()
const collectionId = computed(() => route.query.collection as string | undefined)
</script>

<template>
  <HelpArticleEditor :collection-id="collectionId" />
</template>
