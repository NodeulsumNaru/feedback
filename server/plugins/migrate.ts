import { consola } from 'consola'
import { resolve } from 'path'

const logger = consola.withTag('migrate')

export default defineNitroPlugin(async () => {
  if (import.meta.preset === 'node-server') {
    logger.info('Starting database migration...')

    const { migrate } = await import('drizzle-orm/postgres-js/migrator')
    const { default: postgres } = await import('postgres')
    const { drizzle } = await import('drizzle-orm/postgres-js')
    // Session locks must be acquired and released by the same connection.
    const connection = postgres(process.env.DATABASE_URL!, { max: 1 })
    const db = drizzle(connection)
    const { sql } = await import('drizzle-orm')

    const migrationsFolder = resolve(process.env.MIGRATIONS_DIR || 'server/db/migrations')
    logger.info(`Migrations folder: ${migrationsFolder}`)

    try {
      await db.execute(sql`SELECT pg_advisory_lock(42)`)
      await migrate(db, { migrationsFolder })
      logger.success('Database migration completed')
    } catch (error) {
      logger.error('Database migration failed:', error)
      throw error
    } finally {
      try { await db.execute(sql`SELECT pg_advisory_unlock(42)`) }
      finally { await connection.end() }
    }
  }
})
