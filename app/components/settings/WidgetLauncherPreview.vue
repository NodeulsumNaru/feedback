<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { resolveAttachmentUrl } from '#layers/feedlog/app/utils/attachment'
import type { WidgetLauncherAlignment, WidgetLauncherCloseBehavior } from '#layers/feedlog/shared/constants/widget-launcher'
import { WIDGET_LAUNCHER_OFFSET_DEFAULT } from '#layers/feedlog/shared/constants/widget-launcher'

const props = defineProps<{
  alignment: WidgetLauncherAlignment
  bottomOffset: number | string
  sideOffset: number | string
  closeBehavior: WidgetLauncherCloseBehavior
  enabled: boolean
}>()
const { t } = useI18n()
const { data: config, error: configError, refresh } = useFetch('/api/widget/config', { server: false })
const device = ref<'desktop' | 'mobile'>('desktop')
const frame = ref<HTMLElement | null>(null)
const launcher = ref<HTMLButtonElement | null>(null)
const resetButton = ref<HTMLButtonElement | null>(null)
const scale = ref(0.4)
const width = computed(() => device.value === 'desktop' ? 900 : 390)
const height = 720
const mode = ref<'button' | 'tab' | 'hidden'>('button')
const panelOpen = ref(false)
const visitorPosition = ref<{ side: WidgetLauncherAlignment; ratio: number } | null>(null)
const dragPosition = ref<{ x: number; y: number } | null>(null)
let pointer: { id: number; x: number; y: number; left: number; top: number; moved: boolean } | null = null
let suppressClick = false
let observer: ResizeObserver | undefined

// Match the existing portal preview: scale a complete viewport, never squeeze
// the widget itself into the settings card's available width.
function measure() { if (frame.value) scale.value = frame.value.clientWidth / width.value }
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (frame.value) observer.observe(frame.value)
  measure()
})
onBeforeUnmount(() => observer?.disconnect())
const brandStyle = computed(() => config.value ? { '--primary': config.value.branding.primary, '--primary-foreground': config.value.branding.primaryForeground } : {})
const productName = computed(() => config.value?.org.name || t('widget.thisProduct'))
const orgInitial = computed(() => config.value?.org.name.trim().charAt(0).toUpperCase() || 'F')
const side = computed(() => visitorPosition.value?.side ?? props.alignment)
const isTab = computed(() => mode.value === 'tab')
const launcherWidth = computed(() => isTab.value ? 22 : 56)
function offset(value: number | string) {
  const number = Number(value)
  return String(value).trim() !== '' && Number.isSafeInteger(number) && number >= 0 ? number : WIDGET_LAUNCHER_OFFSET_DEFAULT
}
const settledPosition = computed(() => {
  // Match the SDK's viewport limits while keeping the configured offsets intact.
  const margin = isTab.value ? 0 : visitorPosition.value ? WIDGET_LAUNCHER_OFFSET_DEFAULT : Math.min(offset(props.sideOffset), width.value - 112)
  const bottom = Math.min(offset(props.bottomOffset), height - 76)
  return {
    x: side.value === 'left' ? margin : width.value - launcherWidth.value - margin,
    y: visitorPosition.value ? 14 + visitorPosition.value.ratio * (height - 70) : height - 56 - Math.max(isTab.value ? 12 : 0, bottom),
  }
})
const position = computed(() => dragPosition.value ?? settledPosition.value)
const launcherStyle = computed<CSSProperties>(() => ({
  left: `${position.value.x}px`, top: `${position.value.y}px`, width: `${launcherWidth.value}px`,
  borderRadius: !isTab.value ? '28px' : dragPosition.value ? '8px' : side.value === 'left' ? '0 8px 8px 0' : '8px 0 0 8px',
}))
const panelStyle = computed<CSSProperties>(() => {
  if (device.value === 'mobile') return { inset: '0' }
  const above = settledPosition.value.y - 16 - 12
  const below = height - (settledPosition.value.y + 56 + 16) - 12
  const panelHeight = Math.min(680, above >= 480 ? above : below >= 480 ? below : height - 24)
  const panelWidth = 400
  const preferredLeft = side.value === 'left' ? settledPosition.value.x : settledPosition.value.x + launcherWidth.value - panelWidth
  const innerLeft = side.value === 'left' ? settledPosition.value.x + launcherWidth.value + 16 : settledPosition.value.x - 16 - panelWidth
  const left = above >= 480 || below >= 480 ? preferredLeft : innerLeft
  return { width: `${panelWidth}px`, height: `${panelHeight}px`, left: `${Math.max(12, Math.min(width.value - panelWidth - 12, left))}px`, top: `${above >= 480 ? settledPosition.value.y - 16 - panelHeight : below >= 480 ? settledPosition.value.y + 72 : 12}px` }
})
const footerHint = computed(() => !props.enabled ? t('settings.widget.previewDisabled') : mode.value === 'hidden' ? t('settings.widget.previewState_hidden') : t('settings.widget.previewHint'))

function endDrag(cancel = false) {
  if (!pointer) return
  const id = pointer.id
  if (pointer.moved && dragPosition.value && !cancel) {
    visitorPosition.value = { side: dragPosition.value.x + launcherWidth.value / 2 < width.value / 2 ? 'left' : 'right', ratio: (dragPosition.value.y - 14) / (height - 70) }
  }
  pointer = null
  dragPosition.value = null
  if (launcher.value?.hasPointerCapture(id)) launcher.value.releasePointerCapture(id)
}
function reset() {
  endDrag(true)
  mode.value = 'button'
  panelOpen.value = false
  visitorPosition.value = null
  suppressClick = false
}
watch(() => [props.alignment, props.bottomOffset, props.sideOffset, props.closeBehavior, props.enabled], reset)
watch(device, () => { reset(); nextTick(measure) })
function startDrag(event: PointerEvent) {
  if (event.button !== 0 || panelOpen.value) return
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, left: settledPosition.value.x, top: settledPosition.value.y, moved: false }
  suppressClick = false
  launcher.value?.setPointerCapture(event.pointerId)
}
function moveDrag(event: PointerEvent) {
  if (!pointer || pointer.id !== event.pointerId) return
  const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y
  if (!pointer.moved && Math.hypot(dx, dy) < 8) return
  pointer.moved = true
  suppressClick = true
  dragPosition.value = { x: Math.max(0, Math.min(width.value - launcherWidth.value, pointer.left + dx / scale.value)), y: Math.max(14, Math.min(height - 56, pointer.top + dy / scale.value)) }
}
function openPanel() {
  if (suppressClick) { suppressClick = false; return }
  mode.value = 'button'
  panelOpen.value = !panelOpen.value
}
function closeLauncher() {
  mode.value = props.closeBehavior === 'hide' ? 'hidden' : 'tab'
  panelOpen.value = false
  nextTick(() => (mode.value === 'hidden' ? resetButton.value : launcher.value)?.focus())
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') { endDrag(true); return }
  if (panelOpen.value || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  visitorPosition.value = {
    side: event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : side.value,
    ratio: Math.max(0, Math.min(1, (settledPosition.value.y - 14 + (event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0)) / (height - 70))),
  }
}
function closePanel() {
  panelOpen.value = false
  nextTick(() => (mode.value === 'hidden' ? resetButton.value : launcher.value)?.focus())
}
</script>

<template>
  <div
    class="min-w-0 space-y-3"
    data-widget-preview
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {{ $t('settings.widget.previewTitle') }}
      </p>
      <div class="inline-flex rounded-md border border-border bg-background p-0.5">
        <button
          v-for="item in (['desktop', 'mobile'] as const)"
          :key="item"
          type="button"
          class="h-6 px-2 rounded flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
          :class="device === item ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground'"
          :aria-pressed="device === item"
          @click="device = item"
        >
          <Icon
            :name="item === 'desktop' ? 'lucide:monitor' : 'lucide:smartphone'"
            size="13"
          />{{ $t(`settings.widget.preview_${item}`) }}
        </button>
      </div>
    </div>
    <div
      v-if="configError"
      class="text-xs text-destructive"
      role="alert"
    >
      {{ $t('settings.widget.previewFailed') }} <button
        type="button"
        class="underline"
        @click="refresh()"
      >
        {{ $t('settings.widget.retry') }}
      </button>
    </div>
    <div
      class="rounded-lg border border-border bg-muted/30 overflow-hidden mx-auto"
      :class="device === 'mobile' ? 'max-w-[260px]' : ''"
    >
      <div
        ref="frame"
        class="relative overflow-hidden"
        :style="{ height: `${height * scale}px` }"
      >
        <div
          class="preview-canvas absolute left-0 top-0 origin-top-left bg-background text-foreground overflow-hidden"
          :style="{ ...brandStyle, width: `${width}px`, height: `${height}px`, transform: `scale(${scale})` }"
          :data-device="device"
        >
          <div class="h-16 px-6 border-b border-border bg-card flex items-center justify-between">
            <span class="text-base font-heading font-bold">{{ $t('settings.widget.previewSite') }}</span>
            <Icon
              name="lucide:menu"
              size="20"
              class="text-muted-foreground"
            />
          </div>
          <div
            class="p-8 space-y-6"
            aria-hidden="true"
          >
            <div class="h-5 w-40 bg-muted rounded" />
            <div class="h-3 w-3/4 bg-muted rounded" />
            <div class="h-3 w-1/2 bg-muted rounded" />
            <div class="rounded-xl border border-border bg-card p-6 space-y-5 mt-8">
              <div class="h-4 w-1/3 bg-muted rounded" /><div class="h-3 w-full bg-muted rounded" /><div class="h-3 w-2/3 bg-muted rounded" />
            </div>
          </div>
          <p
            v-if="!enabled"
            class="absolute inset-x-6 bottom-12 text-center text-sm text-muted-foreground"
          >
            {{ $t('settings.widget.previewDisabled') }}
          </p>
          <div
            v-if="enabled && mode !== 'hidden' && !(device === 'mobile' && panelOpen)"
            class="preview-anchor absolute h-14 group"
            :class="{ dragging: dragPosition }"
            :style="launcherStyle"
            :data-mode="mode"
            :data-side="side"
          >
            <button
              ref="launcher"
              type="button"
              class="preview-launcher absolute inset-0 h-14 select-none touch-none border grid place-items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              :class="isTab ? 'bg-card text-primary border-border shadow-sm' : 'bg-primary text-primary-foreground border-transparent shadow-xl'"
              :style="{ borderRadius: launcherStyle.borderRadius }"
              :aria-label="$t(isTab ? 'settings.widget.previewRestore' : 'settings.widget.previewOpenLauncher')"
              @pointerdown="startDrag"
              @pointermove="moveDrag"
              @pointerup="endDrag()"
              @pointercancel="endDrag(true)"
              @lostpointercapture="endDrag(true)"
              @keydown="onKey"
              @click="openPanel"
            >
              <span
                v-if="isTab"
                class="text-xs font-semibold [writing-mode:vertical-rl]"
              >Help</span><Icon
                v-else
                name="lucide:square-pen"
                size="26"
              />
            </button>
            <button
              v-if="mode === 'button' && closeBehavior !== 'none' && !panelOpen && !dragPosition"
              type="button"
              class="preview-close absolute -top-5 size-11 grid place-items-center text-muted-foreground hover:text-foreground"
              :class="side === 'right' ? '-left-5' : '-right-5'"
              :aria-label="$t('settings.widget.previewCloseLauncher')"
              @click="closeLauncher"
            >
              <Icon
                name="lucide:x"
                size="18"
              />
            </button>
          </div>
          <div
            v-if="enabled && panelOpen"
            class="absolute flex flex-col bg-background shadow-xl overflow-hidden"
            :class="device === 'desktop' ? 'rounded-2xl' : ''"
            :style="panelStyle"
            data-preview-panel
            @keydown.esc="closePanel"
          >
            <header class="min-h-16 px-4 border-b border-border bg-card flex items-center gap-2.5 shrink-0">
              <span
                class="size-7 shrink-0 flex items-center justify-center text-primary"
                aria-hidden="true"
              >
                <Icon
                  name="lucide:arrow-left"
                  size="17"
                />
              </span>
              <img
                v-if="config?.org.logo"
                :src="resolveAttachmentUrl(config.org.logo)!"
                alt=""
                class="size-7 rounded-md object-cover shrink-0"
              >
              <span
                v-else
                class="size-7 rounded-md shrink-0 grid place-items-center bg-primary text-primary-foreground font-heading font-bold text-[13px]"
              >{{ orgInitial }}</span>
              <p class="flex-1 min-w-0 font-heading font-semibold text-[15.5px] truncate">
                {{ $t('widget.agentTitle', { product: productName }) }}
              </p>
              <button
                type="button"
                class="size-6.5 rounded-full bg-secondary hover:opacity-80 transition-opacity flex items-center justify-center text-primary shrink-0"
                :aria-label="$t('settings.widget.previewClosePanel')"
                @click="closePanel"
              >
                <Icon
                  name="lucide:x"
                  size="13"
                />
              </button>
            </header>
            <div class="min-h-0 flex-1 overflow-y-auto bg-background p-3.5 [overflow-wrap:anywhere]">
              <p class="max-w-[88%] rounded-lg border border-border bg-card px-3 py-2.5 text-[13.5px]">
                {{ $t('widget.greeting', { product: productName }) }}
              </p>
            </div>
            <div class="px-3 py-2.5 bg-card shrink-0">
              <div class="rounded-md border border-border bg-card">
                <textarea
                  readonly
                  tabindex="-1"
                  rows="1"
                  :placeholder="$t('widget.placeholder')"
                  :aria-label="$t('widget.placeholder')"
                  class="w-full min-h-12 max-h-[120px] px-3 py-2 bg-transparent text-[13.5px] leading-normal resize-none focus:outline-none"
                />
                <div class="flex items-center justify-between px-1.5 py-1">
                  <button
                    type="button"
                    disabled
                    class="h-6.5 w-7 rounded-md flex items-center justify-center text-muted-foreground disabled:cursor-default"
                    :aria-label="$t('widget.attachImage')"
                  >
                    <Icon
                      name="lucide:image"
                      size="15"
                    />
                  </button>
                  <button
                    type="button"
                    disabled
                    class="px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground text-[12.5px] font-heading font-semibold disabled:opacity-40 disabled:cursor-default"
                  >
                    {{ $t('widget.send') }}
                  </button>
                </div>
              </div>
            </div>
            <p class="pt-1.5 pb-1.5 bg-card text-center text-[10.5px] text-muted-foreground shrink-0">
              {{ $t('board.poweredBy') }}FeedLog
            </p>
          </div>
        </div>
      </div>
    </div>
    <div class="text-center text-[11px] leading-5 text-muted-foreground">
      <span role="status">{{ footerHint }}</span>
      <Button
        variant="link"
        size="xs"
        class="ml-2 align-baseline text-[11px] font-normal text-muted-foreground underline hover:text-foreground"
        as-child
      >
        <button
          ref="resetButton"
          type="button"
          @click="reset"
        >
          {{ $t('settings.widget.previewReset') }}
        </button>
      </Button>
    </div>
  </div>
</template>

<style scoped>
.preview-anchor { transition: left 220ms ease, top 220ms ease, width 220ms ease; }
.preview-anchor.dragging { transition: none; }
.preview-launcher { transition: border-radius 220ms ease, color 220ms ease, background-color 220ms ease; }
.preview-anchor[data-mode='tab'] .preview-launcher::after { content: ''; position: absolute; top: 0; bottom: 0; width: 44px; }
.preview-anchor[data-side='left'] .preview-launcher::after { left: 0; }
.preview-anchor[data-side='right'] .preview-launcher::after { right: 0; }
.preview-close { opacity: 0; transition: opacity 150ms ease; }
.preview-anchor:hover .preview-close, .preview-anchor:focus-within .preview-close, [data-device='mobile'] .preview-close { opacity: 1; }
@media (hover: none) { .preview-close { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .preview-anchor, .preview-launcher, .preview-close { transition: none; } }
</style>
