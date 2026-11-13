import { eq } from 'drizzle-orm'
import { getRequestURL } from 'h3'
import { uuidv7 } from 'uuidv7'
import { organizationWidget } from '#layers/feedlog/server/db/schemas'
import { checkEnabledRuleCap, updateWidgetSettingsSchema } from '#layers/feedlog/shared/schemas/widget'
import { resolveWidgetSettings } from '#layers/feedlog/shared/utils/widget-settings'
import type { ResolvedWidgetSettings } from '#layers/feedlog/shared/utils/widget-settings'

// PATCH /api/admin/widget — update widget settings (feedlog:moderate).
export default defineEventHandler(async (event): Promise<ResolvedWidgetSettings & { baseUrl: string }> => {
  const { orgId } = await requireOrgPermission(event, { feedlog: ['moderate'] })

  // safeParse, not readValidatedBody: the latter lets the raw ZodError through,
  // and h3 serialises its whole issue list — regex and all — into the message
  // the admin ends up reading in a toast.
  const parsed = updateWidgetSettingsSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: parsed.error.issues[0]?.message || 'Invalid widget settings',
    })
  }
  const body = parsed.data

  const { customRules, supportEmail, ...fields } = body
  const patch: Partial<typeof organizationWidget.$inferInsert> = { ...fields }
  if (supportEmail !== undefined) patch.supportEmail = supportEmail || null
  if (customRules) {
    patch.customRules = customRules.map(rule => ({
      ...rule,
      id: rule.id || `c_${uuidv7()}`,
    }))
  }

  const saved = await useDB().transaction(async (tx) => {
    // Create before locking so concurrent first saves share the same row.
    await tx.insert(organizationWidget).values({ orgId }).onConflictDoNothing()
    const [existing] = await tx.select().from(organizationWidget)
      .where(eq(organizationWidget.orgId, orgId)).for('update')

    // Rule limits span two fields; validate against the locked current values.
    const capError = checkEnabledRuleCap(
      body.disabledBuiltins ?? existing!.disabledBuiltins,
      patch.customRules ?? existing!.customRules,
    )
    if (capError) {
      throw createError({ statusCode: 400, message: capError })
    }

    if (!Object.keys(body).length) return existing!
    // Each settings section owns its fields, so another section cannot be
    // overwritten by values read before its save completed.
    const [updated] = await tx.update(organizationWidget).set(patch)
      .where(eq(organizationWidget.orgId, orgId)).returning()
    return updated!
  })

  return {
    ...resolveWidgetSettings(saved),
    baseUrl: getRequestURL(event).origin,
  }
})
