import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { WIDGET_LAUNCHER_CONFIG_DEFAULT } from '../shared/constants/widget-launcher'
import { updateWidgetSettingsSchema } from '../shared/schemas/widget'

test('launcher settings require a complete valid object while other sections remain independent', () => {
  const launcherConfig = { alignment: 'left', bottomOffset: 2001, sideOffset: 600, closeBehavior: 'hide' }
  assert.deepEqual(updateWidgetSettingsSchema.parse({ launcherConfig }), { launcherConfig })
  for (const offset of [0, 201, 10000, Number.MAX_SAFE_INTEGER]) {
    const config = { ...launcherConfig, bottomOffset: offset, sideOffset: offset }
    assert.deepEqual(updateWidgetSettingsSchema.parse({ launcherConfig: config }), { launcherConfig: config })
  }
  assert.deepEqual(updateWidgetSettingsSchema.parse({ enabled: false }), { enabled: false })
  assert.deepEqual(updateWidgetSettingsSchema.parse({ supportEmail: '' }), { supportEmail: '' })

  for (const invalid of [
    null, [], 'left', {}, { alignment: 'left' },
    { ...launcherConfig, alignment: 'center' },
    { ...launcherConfig, closeBehavior: 'hidden' },
    { ...launcherConfig, bottomOffset: -1 },
    { ...launcherConfig, bottomOffset: Number.MAX_SAFE_INTEGER + 1 },
    { ...launcherConfig, bottomOffset: Infinity },
    { ...launcherConfig, bottomOffset: NaN },
    { ...launcherConfig, sideOffset: 0.5 },
    { ...launcherConfig, sideOffset: '20' },
  ]) {
    assert.equal(updateWidgetSettingsSchema.safeParse({ launcherConfig: invalid }).success, false)
  }
})

test('launcher migration adds one JSONB column and preserves existing widget settings', async () => {
  const db = new PGlite()
  const migration = (name: string) => readFile(new URL(`../server/db/migrations/${name}.sql`, import.meta.url), 'utf8')
  try {
    await db.exec((await migration('0007_giant_post')).split('--> statement-breakpoint')[0]!)
    await db.exec(await migration('0010_careful_firebird'))
    await db.exec("INSERT INTO organization_widget (org_id, enabled, support_email, conversation_retention_days) VALUES ('existing-org', false, 'support@example.com', 30)")
    const before = await db.query<Record<string, unknown>>('SELECT * FROM organization_widget')

    await db.exec(await migration('0015_widget_launcher_config'))
    const after = await db.query<Record<string, unknown>>('SELECT * FROM organization_widget')
    assert.deepEqual(after.rows[0], { ...before.rows[0], launcher_config: WIDGET_LAUNCHER_CONFIG_DEFAULT })
    assert.equal(Object.keys(after.rows[0]!).length, 9)

    await db.exec("INSERT INTO organization_widget (org_id) VALUES ('new-org')")
    const inserted = await db.query<{ launcher_config: unknown }>("SELECT launcher_config FROM organization_widget WHERE org_id = 'new-org'")
    assert.deepEqual(inserted.rows[0]!.launcher_config, WIDGET_LAUNCHER_CONFIG_DEFAULT)
    const constraints = await db.query("SELECT 1 FROM pg_constraint WHERE conrelid = 'organization_widget'::regclass AND contype = 'c'")
    assert.equal(constraints.rows.length, 0)
  }
  finally {
    await db.close()
  }
})
