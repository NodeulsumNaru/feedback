import { z } from 'zod/v4'
import type { OrgMetadataInput } from './branding'
import { parseOrgMetadata } from './branding'

export const portalModulesSchema = z.object({
  helpCenter: z.boolean().optional(),
})

export type PortalModules = z.infer<typeof portalModulesSchema>

export interface ResolvedPortalModules {
  helpCenter: boolean
}

export const PORTAL_MODULES_DEFAULTS: ResolvedPortalModules = {
  helpCenter: false,
}

export function parsePortalModules(metadata: OrgMetadataInput): PortalModules {
  const result = portalModulesSchema.safeParse(parseOrgMetadata(metadata).portalModules)
  return result.success ? result.data : {}
}

export function resolvePortalModules(metadata: OrgMetadataInput): ResolvedPortalModules {
  const parsed = parsePortalModules(metadata)
  return { helpCenter: parsed.helpCenter ?? PORTAL_MODULES_DEFAULTS.helpCenter }
}

export function mergePortalModulesMetadata(
  metadata: OrgMetadataInput,
  modules: PortalModules,
): Record<string, unknown> {
  return {
    ...parseOrgMetadata(metadata),
    portalModules: portalModulesSchema.parse(modules),
  }
}
