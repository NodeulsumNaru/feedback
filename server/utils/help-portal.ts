import type { H3Event } from 'h3'
import { DEFAULT_ORG_SLUG } from '#layers/feedlog/shared/constants/default-org'
import { resolvePortalModules } from '#layers/feedlog/shared/utils/portal-modules'

export async function requireHelpCenterOrg(event: H3Event): Promise<string> {
  const info = await getOrgInfo(event.context.orgSlug ?? DEFAULT_ORG_SLUG)
  const orgId = event.context.orgId ?? info?.id

  if (!orgId || !resolvePortalModules(info?.metadata).helpCenter) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  return orgId
}
