import { agentError } from '../agent/runtime'

export function assertConversationImage(key: string, prefix: string, orgId: string) {
  if (!key.startsWith(`${prefix}/${orgId}/`) || key.split('/').some(segment => segment === '..' || segment === '.'))
    agentError(422, 'invalid_input', 'Image is outside this organization')
}
