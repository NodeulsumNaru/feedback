// Built-in handoff rules live in code; organization_widget only stores the ids
// of built-ins an org has disabled. `scenario` (English) is injected into the AI
// prompt; `scenarioZh` is admin-facing display only.

export interface WidgetCustomRule {
  id: string
  scenario: string
  enabled: boolean
}

export interface WidgetBuiltinRule {
  id: string
  scenario: string
  scenarioZh: string
}

export const WIDGET_MAX_RULE_LENGTH = 180
export const WIDGET_MAX_ENABLED_RULES = 10

export const WIDGET_BUILTIN_RULES: readonly WidgetBuiltinRule[] = [
  {
    id: 'builtin-billing',
    scenario: 'the user requests staff to execute or correct a charge, refund, or invoice requiring account access; exclude policy questions, how-to questions, and self-service payment troubleshooting',
    scenarioZh: '用户要求客服代办或纠正扣费、退款、发票，需要访问账户；不含政策咨询、操作指引和自助支付排查',
  },
  {
    id: 'builtin-account-access',
    scenario: 'the user needs staff to verify identity, unlock or restore a restricted account, or investigate suspected unauthorized access; exclude general login and password-reset instructions',
    scenarioZh: '用户需要客服核验身份、解锁或恢复受限账户，或调查疑似盗用；不含一般登录和密码重置指引',
  },
  {
    id: 'builtin-privacy-legal',
    scenario: 'the user submits a formal privacy or rights claim, or requests staff to delete or export private account data; exclude policy questions and instructions for self-service account deletion',
    scenarioZh: '用户提出正式隐私或权利申诉，或要求客服代为删除、导出账户私密数据；不含政策咨询和自助注销指引',
  },
] as const

export const WIDGET_BUILTIN_RULE_IDS: readonly string[] = WIDGET_BUILTIN_RULES.map(r => r.id)
