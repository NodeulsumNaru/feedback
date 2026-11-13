import { useNow } from '@vueuse/core'
import { formatConversationTime } from '#layers/feedlog/shared/utils/conversation-time'

export function useConversationTime() {
  const { t, locale } = useI18n()
  const now = useNow({ interval: 30000 })
  return (value: string | Date) => formatConversationTime(value, locale.value, t('time.justNow'), now.value.getTime())
}
