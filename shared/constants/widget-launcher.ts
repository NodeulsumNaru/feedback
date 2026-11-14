export const WIDGET_LAUNCHER_ALIGNMENTS = ['right', 'left'] as const
export type WidgetLauncherAlignment = typeof WIDGET_LAUNCHER_ALIGNMENTS[number]

export const WIDGET_LAUNCHER_ALIGNMENT_DEFAULT: WidgetLauncherAlignment = 'right'
export const WIDGET_LAUNCHER_OFFSET_DEFAULT = 20
export const WIDGET_LAUNCHER_OFFSET_MIN = 0

export const WIDGET_LAUNCHER_CLOSE_BEHAVIORS = ['none', 'collapse', 'hide'] as const
export type WidgetLauncherCloseBehavior = typeof WIDGET_LAUNCHER_CLOSE_BEHAVIORS[number]
export const WIDGET_LAUNCHER_CLOSE_BEHAVIOR_DEFAULT: WidgetLauncherCloseBehavior = 'collapse'

export interface WidgetLauncherConfig {
  alignment: WidgetLauncherAlignment
  bottomOffset: number
  sideOffset: number
  closeBehavior: WidgetLauncherCloseBehavior
}

export const WIDGET_LAUNCHER_CONFIG_DEFAULT: WidgetLauncherConfig = {
  alignment: WIDGET_LAUNCHER_ALIGNMENT_DEFAULT,
  bottomOffset: WIDGET_LAUNCHER_OFFSET_DEFAULT,
  sideOffset: WIDGET_LAUNCHER_OFFSET_DEFAULT,
  closeBehavior: WIDGET_LAUNCHER_CLOSE_BEHAVIOR_DEFAULT,
}
