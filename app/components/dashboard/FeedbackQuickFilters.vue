<script setup lang="ts">
// Quick-filter rail: writes the same conditions the chip bar holds.

const props = defineProps<{
  conditions: FilterCondition[]
  boards: { id: string, name: string }[]
}>()

const emit = defineEmits<{
  pick: [field: EnumFilterField, value: string]
  clear: []
}>()

const { t } = useI18n()

const boardsOpen = ref(true)

const statuses = computed(() => STATUS_OPTIONS.map(s => ({
  value: s.value,
  label: t(statusLabelKey(s.value)),
  color: s.color,
})))

const boardEntries = computed(() => [
  ...props.boards.map(b => ({ value: b.id, label: b.name })),
  { value: 'none', label: t('dashboard.filter.noBoard') },
])

const lit = (field: EnumFilterField, value: string) => railValue(props.conditions, field) === value
</script>

<template>
  <aside class="hidden min-[1160px]:flex w-48 shrink-0 border-r border-border bg-background/30 flex-col gap-5 p-3 overflow-y-auto">
    <div class="flex flex-col gap-0.5">
      <p class="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {{ $t('dashboard.feedback.statuses') }}
      </p>
      <button
        v-for="s in statuses"
        :key="s.value"
        class="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors"
        :class="lit('status', s.value) ? 'bg-secondary text-primary font-bold' : 'text-foreground hover:bg-background'"
        @click="emit('pick', 'status', s.value)"
      >
        <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: s.color }" />
        <span class="truncate">{{ s.label }}</span>
      </button>

      <button
        class="flex items-center gap-2.5 w-full px-2 py-1.5 mt-1 rounded-lg text-xs font-bold text-muted-foreground hover:text-primary transition-colors text-left"
        @click="emit('clear')"
      >
        <Icon name="lucide:rotate-ccw" size="13" class="shrink-0" />
        <span class="truncate">{{ $t('dashboard.feedback.clearAllFilters') }}</span>
      </button>
    </div>

    <div class="flex flex-col gap-0.5">
      <p class="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {{ $t('dashboard.feedback.quickFilters') }}
      </p>
      <button
        class="flex items-center gap-2 w-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        @click="boardsOpen = !boardsOpen"
      >
        <Icon :name="boardsOpen ? 'lucide:chevron-down' : 'lucide:chevron-right'" size="12" class="shrink-0" />
        {{ $t('dashboard.filter.board') }}
      </button>
      <div v-if="boardsOpen" class="ml-3 pl-2 border-l border-border flex flex-col gap-0.5">
        <button
          v-for="b in boardEntries"
          :key="b.value"
          class="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors"
          :class="lit('boardId', b.value) ? 'bg-secondary text-primary font-bold' : 'text-foreground hover:bg-background'"
          @click="emit('pick', 'boardId', b.value)"
        >
          <Icon name="lucide:layers" size="13" class="shrink-0 opacity-60" />
          <span class="truncate">{{ b.label }}</span>
        </button>
      </div>
    </div>
  </aside>
</template>
