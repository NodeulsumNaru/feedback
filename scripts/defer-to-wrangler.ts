// Cloudflare 빌드 메모리 절감: 무거운 서버 의존성을 Nitro(Rollup) 번들에서 빼고
// `wrangler deploy` 단계의 esbuild가 번들하도록 넘긴다.
//
// Rollup은 트리셰이킹을 위해 모든 모듈의 AST와 스코프/객체 분석 정보를 끝까지
// 메모리에 들고 있어서, 소스 33MB(3,000+ 모듈)짜리 그래프에 힙이 2GB 이상 필요했다.
// 그중 1/3 이상이 Mastra·AI SDK·zod 계열. 이 패키지들은 bare import 그대로 남겨두면
// wrangler(esbuild, Go로 동작해서 메모리를 거의 안 씀)가 배포 시점에 node_modules에서
// 찾아 번들한다. 최종 Worker 결과물은 동일하게 한 번들로 묶인다.
//
// 주의: 이렇게 뺀 패키지 안쪽 import에는 Nitro alias가 적용되지 않으므로,
// 같은 대체(pg-native, debug)를 wrangler alias로도 걸어줘야 한다(nuxt.config.ts 참고).
import { mkdirSync, writeFileSync } from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import { join } from 'node:path'
import type { Nitro } from 'nitropack'
import type { Plugin } from 'rollup'

export const DEFERRED_PACKAGES = [
  '@mastra/',
  '@ai-sdk/',
  '@modelcontextprotocol/',
  'ai',
  'openai',
  'js-tiktoken',
  'zod',
  'pg',
]

const matches = (id: string) => DEFERRED_PACKAGES.some(p =>
  p.endsWith('/') ? id.startsWith(p) : id === p || id.startsWith(`${p}/`))

export function deferToWrangler(): Plugin {
  return {
    name: 'feedback:defer-to-wrangler',
    resolveId: {
      order: 'pre',
      handler(source) {
        if (matches(source)) return { id: source, external: true }
        return null
      },
    },
  }
}

/**
 * Node 내장 모듈 매핑을 wrangler alias로도 복제한다.
 *
 * Nitro는 Rollup 안에서 unenv로 `crypto` → `node:crypto`(workerd 네이티브)나
 * `child_process` → unenv 폴리필처럼 내장 모듈을 바꿔준다. wrangler로 넘긴 패키지는
 * 이 처리를 못 받으니, Nitro가 쓰는 것과 똑같은 unenv 환경을 계산해서 alias로 넣는다.
 * (nitro.options.cloudflare.wrangler는 빌드 후 .output/server/wrangler.json에 기록됨)
 */
export async function syncBuiltinAliasesToWrangler(nitro: Nitro) {
  const req = createRequire(createRequire(import.meta.url).resolve('nitropack/package.json'))
  const { defineEnv } = await import(req.resolve('unenv')) as typeof import('unenv')
  // nitropack/dist/rollup의 getRollupConfig와 같은 인자
  const { env } = defineEnv({
    nodeCompat: nitro.options.node === false,
    npmShims: true,
    resolve: true,
    presets: nitro.options.unenv,
    overrides: { alias: nitro.options.alias },
  })
  // wrangler alias는 `node:xxx` 같은 비경로 값을 못 받으므로, 네이티브 모듈은
  // `export * from 'node:xxx'` 한 줄짜리 shim 파일을 만들어서 그 경로로 연결한다.
  const shimDir = join(nitro.options.buildDir, 'worker-node-shims')
  mkdirSync(shimDir, { recursive: true })
  const toPath = (target: string) => {
    if (!target.startsWith('node:')) return target
    const file = join(shimDir, `${target.slice(5).replaceAll('/', '__')}.mjs`)
    writeFileSync(file, `export * from '${target}'\nexport { default } from '${target}'\n`)
    return file
  }
  const alias: Record<string, string> = {}
  for (const name of builtinModules) {
    if (name.startsWith('_')) continue
    const bare = name.replace(/^node:/, '')
    // unenv.external로 지정된 것(node:fs 등)은 Rollup에서처럼 workerd 네이티브 그대로
    const target = env.external.includes(`node:${bare}`) || env.external.includes(bare)
      ? `node:${bare}`
      : env.alias[bare] ?? env.alias[`node:${bare}`] ?? `node:${bare}`
    alias[bare] = toPath(target)
    // workerd에 없는 모듈(node:child_process 등)은 node: 접두사로 import해도 폴리필로
    if (target !== `node:${bare}`) alias[`node:${bare}`] = toPath(target)
  }
  const cf = (nitro.options.cloudflare ||= {} as NonNullable<Nitro['options']['cloudflare']>)
  const wrangler = (cf.wrangler ||= {}) as { alias?: Record<string, string> }
  wrangler.alias = { ...alias, ...wrangler.alias }
}
