#!/usr/bin/env node
// Cloudflare Workers Builds처럼 메모리가 빠듯한 환경용 2단계 빌드.
//
// `nuxt build` 한 번에 Vite(client+server)와 Nitro 번들링을 다 하면, Vite 단계에서
// 쓴 힙(~1.3GB)이 해제되지 않은 상태로 Nitro 번들링이 이어져 피크가 4GB를 넘김.
// 그래서 같은 빌드를 두 프로세스로 나눔:
//   1) Vite 빌드 → experimental.buildCache로 .nuxt 결과물을 캐시 → 종료
//   2) 캐시 복원(Vite 건너뜀) → Nitro 번들링만 수행
// 각 프로세스는 자기 단계 메모리만 쓰고 끝나므로 전체 피크가 크게 줄어듦.
//
// 사용: pnpm build:cf  (NITRO_PRESET 기본값 cloudflare-module)
// 힙 상한은 BUILD_HEAP_MB(기본 2048)로 조절. 상한을 낮게 잡아야 V8이 GC를
// 미루지 않고 자주 돌려서 실제 RSS가 상한 근처에서 유지됨.
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const heapMb = process.env.BUILD_HEAP_MB || '2048'
// pnpm의 .bin 래퍼로 실행해야 NODE_PATH가 잡혀서 nuxt.config.ts의 @nuxt/kit 등이 해석됨
const nuxtBin = process.platform === 'win32' ? 'node_modules\\.bin\\nuxt.cmd' : 'node_modules/.bin/nuxt'
const baseEnv = {
  NITRO_PRESET: 'cloudflare-module',
  ...process.env,
  NODE_ENV: 'production',
  NUXT_LOW_MEMORY_BUILD: '1',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=${heapMb}`.trim(),
}

// 이전 빌드 캐시가 남아 있으면 1단계가 Vite를 건너뛰고 바로 Nitro까지 가버리므로
// (CI에서는 항상 새 체크아웃이지만 로컬 재실행 대비) 캐시를 비우고 시작.
rmSync('node_modules/.cache/nuxt/builds', { recursive: true, force: true })

for (const phase of ['vite', 'nitro']) {
  console.log(`\n▶ [build-low-memory] ${phase} 단계 시작 (heap ${heapMb}MB)\n`)
  const r = spawnSync(nuxtBin, ['build'], {
    shell: process.platform === 'win32',
    stdio: 'inherit',
    env: { ...baseEnv, NUXT_LOW_MEMORY_BUILD_PHASE: phase },
  })
  if (r.status !== 0) {
    console.error(`✖ [build-low-memory] ${phase} 단계 실패 (exit ${r.status ?? r.signal})`)
    process.exit(r.status ?? 1)
  }
}

// package.json "build" 스크립트와 동일한 후처리: 런타임 마이그레이션 파일 동봉
mkdirSync('.output/server/db', { recursive: true })
cpSync('server/db/migrations', '.output/server/db/migrations', { recursive: true })
// Vercel: Nitro는 앱 전체를 __fallback.func 하나로 묶고 모든 경로가 그 함수로 간다.
// 그런데 큐 트리거(experimentalTriggers)가 붙은 함수는 공개 주소가 없어지고 큐
// 인프라만 호출할 수 있어서, 트리거를 거기 두면 사이트 전체가 404가 된다.
// → 트리거를 앱 함수에서 떼어 내고, 같은 번들을 복사한 전용 함수(_inbox-queue.func)에 붙인다.
//   수신 요청은 server/middleware/inbox-queue.ts가 ce-type 헤더로 먼저 가로채 처리한다.
const vercelFn = '.vercel/output/functions/__fallback.func'
if (existsSync(`${vercelFn}/.vc-config.json`)) {
  const config = JSON.parse(readFileSync(`${vercelFn}/.vc-config.json`, 'utf8'))
  if (config.experimentalTriggers?.length) {
    const consumerFn = '.vercel/output/functions/_inbox-queue.func'
    rmSync(consumerFn, { recursive: true, force: true })
    // cp -a: node_modules의 상대 심볼릭 링크를 그대로 보존
    const cp = spawnSync('cp', ['-a', vercelFn, consumerFn], { stdio: 'inherit' })
    if (cp.status !== 0) process.exit(cp.status ?? 1)
    writeFileSync(`${consumerFn}/.vc-config.json`, JSON.stringify(config, null, 2))
    delete config.experimentalTriggers
    writeFileSync(`${vercelFn}/.vc-config.json`, JSON.stringify(config, null, 2))
    console.log('✔ [build-low-memory] 큐 트리거를 _inbox-queue.func로 분리')
  }
}

console.log('\n✔ [build-low-memory] 완료')
