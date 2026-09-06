<script setup lang="ts">
// Three-segment filter chip: field | operator | value(s) | ×
// The `single` kind has no operator segment.

import type { FilterValueOption } from './FilterValuePanel.vue'

const props = withDefaults(defineProps<{
  label: string
  icon: string
  kind: 'enum' | 'date' | 'single'
  op: string
  values?: string[]
  from?: string
  to?: string
  options?: FilterValueOption[]
  searchable?: boolean
}>(), {
  values: () => [],
  options: () => [],
  from: undefined,
  to: undefined,
  searchable: false,
})

const emit = defineEmits<{
  'update:op': [op: string]
  'update:values': [values: string[]]
  'update:range': [range: { from?: string, to?: string }]
  'remove': []
}>()

const { t } = useI18n()

const OPS: Record<string, string[]> = {
  enum: ['is', 'not'],
  date: ['after', 'before', 'range'],
  single: [],
}

const opLabel = (op: string) => t(`dashboard.filter.op.${op}`)

const firstKnown = computed(() => props.values.map(v => props.options.find(o => o.value === v)).find(Boolean))

// The option-list guard matters: candidates load async, and nothing resolves until they do.
const isStale = computed(() => props.kind !== 'date'
  && props.values.length > 0
  && props.options.length > 0
  && !firstKnown.value)

const valueLabel = computed(() => {
  if (props.kind === 'date') {
    if (props.op === 'range') return `${props.from || '…'} – ${props.to || '…'}`
    return props.from || props.to || t('dashboard.filter.pickDate')
  }
  if (!props.values.length) return t('dashboard.filter.pickValue')
  if (isStale.value) return t('dashboard.filter.staleValue')
  return firstKnown.value?.label ?? props.values[0]!
})

const extraCount = computed(() => (props.kind === 'date' ? 0 : Math.max(0, props.values.length - 1)))
</script>

<template>
  <div class="inline-flex shrink-0 items-center border border-border rounded-lg overflow-hidden h-7 bg-card">
    <span class="px-2.5 py-1 bg-background text-[10px] font-bold text-muted-foreground border-r border-border flex items-center gap-1.5 whitespace-nowrap">
      <Icon :name="icon" size="14" />
      {{ label }}
    </span>

    <DropdownMenu v-if="kind !== 'single'">
      <DropdownMenuTrigger as-child>
        <button
          class="px-2.5 py-1 text-[10px] font-bold border-r border-border hover:bg-background/50 transition-colors cursor-pointer whitespace-nowrap"
          :class="op === 'not' ? 'text-primary' : 'text-muted-foreground'"
        >
          {{ opLabel(op) }}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="min-w-[120px]">
        <DropdownMenuItem
          v-for="o in OPS[kind]"
          :key="o"
          class="cursor-pointer text-xs"
          :class="o === op ? 'text-primary font-bold' : ''"
          @select="emit('update:op', o)"
        >
          <span class="w-4 shrink-0 flex items-center justify-center">
            <Icon v-if="o === op" name="lucide:check" size="12" />
          </span>
          {{ opLabel(o) }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <button
          class="px-2.5 py-1 text-[10px] font-bold flex items-center gap-1 hover:bg-background/50 transition-colors cursor-pointer whitespace-nowrap"
          :class="isStale ? 'text-muted-foreground italic' : 'text-primary'"
        >
          {{ valueLabel }}
          <span v-if="extraCount" class="text-muted-foreground font-semibold">+{{ extraCount }}</span>
          <Icon name="lucide:chevron-down" size="10" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" class="min-w-[200px] max-w-[320px]">
        <FilterValuePanel
          :kind="kind"
          :op="op"
          :values="values"
          :from="from"
          :to="to"
          :options="options"
          :searchable="searchable"
          @update:op="emit('update:op', $event)"
          @update:values="emit('update:values', $event)"
          @update:range="emit('update:range', $event)"
        />
      </DropdownMenuContent>
    </DropdownMenu>

    <button
      class="px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors border-l border-border"
      @click="emit('remove')"
    >
      <Icon name="lucide:x" size="12" />
    </button>
  </div>
</template>
