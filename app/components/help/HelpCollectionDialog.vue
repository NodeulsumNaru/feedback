<script setup lang="ts">
import { HELP_COLLECTION_ICONS, HELP_COLLECTION_ICON_DEFAULT } from '#layers/feedlog/shared/constants/help'
import type { HelpCollectionIcon } from '#layers/feedlog/shared/constants/help'

export interface HelpCollectionFormValue {
  id: string
  name: string
  description: string | null
  icon: HelpCollectionIcon
  visible: boolean
  articleCount: number
}

const props = defineProps<{ collection?: HelpCollectionFormValue | null }>()
const emit = defineEmits<{ saved: []; deleted: [] }>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const { confirm } = useConfirmDialog()

const isEdit = computed(() => !!props.collection)
const icon = ref<HelpCollectionIcon>(HELP_COLLECTION_ICON_DEFAULT)
const name = ref('')
const description = ref('')
const visible = ref(true)
const error = ref('')
const submitting = ref(false)

watch(open, (value) => {
  if (!value) return
  icon.value = props.collection?.icon ?? HELP_COLLECTION_ICON_DEFAULT
  name.value = props.collection?.name ?? ''
  description.value = props.collection?.description ?? ''
  visible.value = props.collection?.visible ?? true
  error.value = ''
}, { immediate: true })

watch([name, description], () => { error.value = '' })

async function handleSave() {
  if (!name.value.trim()) {
    error.value = t('help.admin.collection.nameRequired')
    return
  }

  submitting.value = true
  error.value = ''
  try {
    const body = {
      name: name.value.trim(),
      description: description.value.trim() || null,
      icon: icon.value,
      visible: visible.value,
    }
    if (props.collection) await $fetch(`/api/admin/help/collections/${props.collection.id}`, { method: 'PATCH', body })
    else await $fetch('/api/admin/help/collections', { method: 'POST', body })

    open.value = false
    emit('saved')
  }
  catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message || t('help.admin.collection.saveFailed')
  }
  finally {
    submitting.value = false
  }
}

async function handleDelete() {
  if (!props.collection) return

  const count = props.collection.articleCount
  const ok = await confirm({
    title: t('help.admin.collection.deleteTitle', { name: props.collection.name }),
    description: t('help.admin.collection.deleteDescription', { n: count }, count),
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
    variant: 'destructive',
  })
  if (!ok) return

  submitting.value = true
  try {
    await $fetch(`/api/admin/help/collections/${props.collection.id}`, { method: 'DELETE' })
    open.value = false
    emit('deleted')
  }
  catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message || t('help.admin.collection.saveFailed')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :show-close-button="false"
      class="!max-w-[460px] !p-0 !gap-0 overflow-hidden border-border bg-card !rounded-xl"
    >
      <div class="px-6 pt-5 pb-1.5">
        <DialogTitle class="font-heading text-base font-bold">
          {{ isEdit ? $t('help.admin.collection.editTitle') : $t('help.admin.collection.createTitle') }}
        </DialogTitle>
      </div>

      <div class="px-6 pb-5">
        <p class="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {{ $t('help.admin.collection.icon') }}
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="option in HELP_COLLECTION_ICONS"
            :key="option"
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-md border transition-colors"
            :class="icon === option
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground hover:bg-secondary'"
            @click="icon = option"
          >
            <Icon :name="`lucide:${option}`" size="16" />
          </button>
        </div>

        <p class="mt-[18px] text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {{ $t('help.admin.collection.name') }}
        </p>
        <input
          v-model="name"
          type="text"
          class="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          :placeholder="$t('help.admin.collection.namePlaceholder')"
        >

        <p class="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {{ $t('help.admin.collection.description') }}
        </p>
        <input
          v-model="description"
          type="text"
          class="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          :placeholder="$t('help.admin.collection.descriptionPlaceholder')"
        >

        <div class="mt-[18px] flex items-start gap-3 rounded-md border border-border bg-background px-3.5 py-3">
          <div class="min-w-0 flex-1">
            <div class="text-[13px] font-bold leading-[18px]">
              {{ $t('help.admin.collection.visible') }}
            </div>
            <div class="mt-0.5 text-xs leading-[17px] text-muted-foreground">
              {{ $t('help.admin.collection.visibleHint') }}
            </div>
          </div>
          <Switch v-model="visible" />
        </div>

        <p v-if="error" class="mt-3 text-xs font-medium text-destructive">
          {{ error }}
        </p>
      </div>

      <div class="flex items-center justify-end gap-2 bg-background px-6 py-3.5">
        <button
          v-if="isEdit"
          type="button"
          class="mr-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/40 px-3 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
          :disabled="submitting"
          @click="handleDelete"
        >
          <Icon name="lucide:trash-2" size="14" />
          {{ $t('help.admin.collection.delete') }}
        </button>
        <button
          type="button"
          class="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-bold hover:bg-secondary"
          @click="open = false"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          type="button"
          class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          :disabled="submitting"
          @click="handleSave"
        >
          {{ $t('common.save') }}
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>
