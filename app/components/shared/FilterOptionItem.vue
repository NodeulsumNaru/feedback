<script setup lang="ts">
defineProps<{
  selected: boolean
  description?: string
}>()
</script>

<template>
  <DropdownMenuItem
    class="group cursor-pointer text-xs focus:text-foreground"
    :class="[selected ? 'text-primary font-bold focus:text-primary' : '', description ? 'items-start' : '']"
  >
    <span class="flex h-4 w-4 shrink-0 items-center justify-center">
      <Icon v-if="selected" name="lucide:check" size="12" class="text-current!" />
    </span>
    <span class="min-w-0">
      <span class="block"><slot /></span>
      <span v-if="description" class="mt-0.5 block whitespace-normal text-xs font-normal leading-5 text-muted-foreground group-focus:text-foreground/80">{{ description }}</span>
    </span>
  </DropdownMenuItem>
</template>
