import type { Pool } from 'pg'
import type { Actor } from '../runtime'
import type { AgentPromptArticle, AgentPromptBoard, AgentPromptContext } from './system'
import { resolveGuestAccess } from '../../../../shared/utils/guest'
import { getEnabledSupportRules, type WidgetConfigRow } from '../../../../shared/utils/widget-settings'
import { isActorAdmin, type OrgListSession } from '../../../../shared/utils/notifications'
import { isGuestSession } from '../../../utils/guest'

export async function agentProduct(pool: Pool, orgId: string) {
  const { rows: [organization] } = await pool.query<{ name: string }>('SELECT name FROM organization WHERE id=$1', [orgId])
  if (!organization) throw new Error('Organization not found')
  return {
    name: organization.name,
  }
}

export async function loadAgentPromptContext(pool: Pool, actor: Actor): Promise<AgentPromptContext> {
  const [organization, widget, boards, articles] = await Promise.all([
    pool.query<{ metadata: string | null }>('SELECT metadata FROM organization WHERE id=$1', [actor.orgId]),
    pool.query<WidgetConfigRow>(`SELECT enabled,support_email AS "supportEmail",disabled_builtins AS "disabledBuiltins",custom_rules AS "customRules",conversation_retention_days AS "conversationRetentionDays" FROM organization_widget WHERE org_id=$1`, [actor.orgId]),
    pool.query<AgentPromptBoard>('SELECT id,name,description FROM board WHERE org_id=$1 ORDER BY position,id', [actor.orgId]),
    pool.query<AgentPromptArticle>(`SELECT a.id,a.title,a.description FROM help_article a
      JOIN help_collection c ON c.id=a.collection_id AND c.org_id=a.org_id
      WHERE a.org_id=$1 AND a.ai_enabled ORDER BY c.position,c.id,a.position,a.id`, [actor.orgId]),
  ])
  const metadata = organization.rows[0]?.metadata
  const guest = resolveGuestAccess(metadata)
  const anonymous = isGuestSession(actor.session)
  const settings = widget.rows[0]
  const product = await agentProduct(pool, actor.orgId)
  return {
    productName: product.name,
    boards: boards.rows,
    supportEmail: settings?.supportEmail,
    supportRules: getEnabledSupportRules(settings),
    knowledgeEnabled: articles.rows.length > 0,
    articles: articles.rows,
    feedback: {
      create: (!anonymous || guest.allowPost) && boards.rows.length > 0,
      vote: !anonymous || guest.allowVote,
      subscribe: !isActorAdmin(actor.session as OrgListSession, actor.orgId),
      commentScope: !anonymous || guest.allowComment ? 'all' : 'own',
    },
  }
}
