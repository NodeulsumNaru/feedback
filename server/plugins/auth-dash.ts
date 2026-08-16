// dash.better-auth.com 대시보드 연동. BETTER_AUTH_API_KEY가 설정돼 있을 때만
// 켜지고, 없으면 아무것도 안 함 (에러 없이 조용히 비활성).
//
// server/utils/better-auth.ts의 registerAuthOverrides()는 auth 인스턴스가
// 처음 만들어지기 전에 딱 한 번만 호출할 수 있어서, Nitro 플러그인(요청이
// 오기 전에 먼저 실행됨)에서 등록하는 게 맞다.

import { dash } from '@better-auth/infra'
import { consola } from 'consola'

const logger = consola.withTag('auth-dash')

export default defineNitroPlugin(() => {
  const apiKey = process.env.BETTER_AUTH_API_KEY
  if (!apiKey) return

  registerAuthOverrides({
    extraPlugins: [
      dash({
        apiKey,
        activityTracking: { enabled: true },
      }),
    ],
  })
  logger.info('Better Auth dash 플러그인 등록됨')
})
