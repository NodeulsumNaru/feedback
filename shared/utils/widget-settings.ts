import type { HandoffRule } from '../inbox/state'
import { CONVERSATION_RETENTION_DEFAULT_DAYS } from '../constants/conversation'
import {
  WIDGET_LAUNCHER_CONFIG_DEFAULT,
  type WidgetLauncherConfig,
} from '../constants/widget-launcher'
import {
  WIDGET_BUILTIN_RULES,
  WIDGET_BUILTIN_RULE_IDS,
  type WidgetCustomRule,
} from '../constants/widget-rules'

// Resolves an organization_widget row (or its absence) into the shape the admin
// UI renders and the AI prompt consumes. No row = all defaults (lazy creation).

export interface WidgetConfigRow {
  enabled: boolean
  supportEmail: string | null
  disabledBuiltins: string[]
  customRules: WidgetCustomRule[]
  conversationRetentionDays: number
  launcherConfig: WidgetLauncherConfig
}

// Both wordings travel to the client: the admin page shows whichever matches
// the dashboard locale, while `scenario` is what reaches the AI prompt.
export interface ResolvedBuiltinRule {
  id: string
  scenario: string
  scenarioZh: string
  enabled: boolean
}

export interface ResolvedWidgetSettings {
  enabled: boolean
  supportEmail: string | null
  conversationRetentionDays: number
  launcherConfig: WidgetLauncherConfig
  rules: {
    builtins: ResolvedBuiltinRule[]
    custom: WidgetCustomRule[]
  }
  enabledCount: number
}

export function countEnabledRules(disabledBuiltins: string[], customRules: WidgetCustomRule[]): number {
  const builtinsOn = WIDGET_BUILTIN_RULE_IDS.filter(id => !disabledBuiltins.includes(id)).length
  const customOn = customRules.filter(r => r.enabled).length
  return builtinsOn + customOn
}

export function resolveWidgetSettings(row: WidgetConfigRow | undefined | null): ResolvedWidgetSettings {
  const enabled = row?.enabled ?? true
  const supportEmail = row?.supportEmail ?? null
  const disabledBuiltins = row?.disabledBuiltins ?? []
  const customRules = row?.customRules ?? []

  const builtins: ResolvedBuiltinRule[] = WIDGET_BUILTIN_RULES.map(r => ({
    id: r.id,
    scenario: r.scenario,
    scenarioZh: r.scenarioZh,
    enabled: !disabledBuiltins.includes(r.id),
  }))

  return {
    enabled,
    supportEmail,
    conversationRetentionDays: row?.conversationRetentionDays ?? CONVERSATION_RETENTION_DEFAULT_DAYS,
    launcherConfig: { ...WIDGET_LAUNCHER_CONFIG_DEFAULT, ...row?.launcherConfig },
    rules: { builtins, custom: customRules },
    enabledCount: countEnabledRules(disabledBuiltins, customRules),
  }
}

// Preserve rule identities and configured wording for handoff attribution.
export function getEnabledSupportRules(row: WidgetConfigRow | undefined | null): HandoffRule[] {
  const settings = resolveWidgetSettings(row)
  return [
    ...settings.rules.builtins.filter(r => r.enabled).map(({ id, scenario, scenarioZh }) => ({ id, scenario, scenarioZh })),
    ...settings.rules.custom.filter(r => r.enabled).map(({ id, scenario }) => ({ id, scenario })),
  ]
}
