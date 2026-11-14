import { widgetActor, withAgentRuntime } from '#layers/feedlog/server/lib/agent/runtime'
import { streamAgentReply } from '#layers/feedlog/server/lib/agent/chat'

export default defineEventHandler(event => withAgentRuntime(event, async () => {
  return streamAgentReply(event, await widgetActor(event))
}))
