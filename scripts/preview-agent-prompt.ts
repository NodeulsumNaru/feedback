import { Pool } from 'pg'
import { renderAgentSystemPrompt, renderAgentPromptTemplate } from '../server/lib/agent/prompts/system'
import { loadAgentPromptContext } from '../server/lib/agent/prompts/context'
import type { Actor } from '../server/lib/agent/runtime'

const args = process.argv.slice(2)
if (!args.length || args[0] === '--template') {
  console.log(renderAgentPromptTemplate())
} else {
  const orgId = args[args.indexOf('--org') + 1]
  const customerId = args[args.indexOf('--customer') + 1]
  if (!args.includes('--org') || !args.includes('--customer') || !orgId || !customerId) {
    throw new Error('Usage: agent:prompt [--template | --org <id> --customer <id>]')
  }
  process.loadEnvFile('.env')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const { rows: [user] } = await pool.query('SELECT id,is_anonymous AS "isAnonymous" FROM "user" WHERE id=$1', [customerId])
    if (!user) throw new Error('Customer not found')
    const { rows: orgList } = await pool.query('SELECT organization_id AS "orgId",role FROM member WHERE user_id=$1 AND organization_id=$2', [customerId, orgId])
    const actor = { orgId, customerId, session: { user, orgList } } as Actor
    console.log(renderAgentSystemPrompt(await loadAgentPromptContext(pool, actor)))
  } finally {
    await pool.end()
  }
}
