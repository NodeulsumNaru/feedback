import { widgetActor, withAgentRuntime } from '#layers/feedlog/server/lib/agent/runtime'
import { readConversationItems } from '#layers/feedlog/server/lib/agent/history'

export default defineEventHandler(event => withAgentRuntime(event, async () => {
  return readConversationItems(event, await widgetActor(event))
}))
