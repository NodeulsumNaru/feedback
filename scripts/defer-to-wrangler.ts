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

// syncBuiltinAliasesToWrangler()가 만든 전역 prelude 파일 경로 (rollup:before에서 설정)
let preludePath: string | undefined

export function deferToWrangler(rootDir: string): Plugin {
  // wrangler(esbuild)는 bare import를 프로젝트 루트 기준으로 찾으므로, 비교 기준도 루트
  const rootImporter = join(rootDir, 'server', '__defer_to_wrangler__.ts')
  const rootIds = new Map<string, Promise<string | undefined>>()
  return {
    name: 'feedback:defer-to-wrangler',
    resolveId: {
      order: 'pre',
      async handler(source, importer, options) {
        if (!matches(source)) return null
        // bare 이름('zod')으로 넘기면 esbuild가 프로젝트 루트 기준으로 다시 찾아서
        // 패키지마다 다른 버전(예: better-auth가 쓰는 zod vs 루트 zod)이 한 버전으로
        // 섞여버림 → `z.validate is not a function` 같은 런타임 오류.
        // Rollup이 import한 쪽 기준으로 찾은 실제 파일 경로를 그대로 넘겨서 버전 유지.
        const [resolved, rootId] = await Promise.all([
          this.resolve(source, importer, { ...options, skipSelf: true }),
          rootIds.get(source) ?? (rootIds.set(source, this.resolve(source, rootImporter, { skipSelf: true })
            .then(r => r?.id)), rootIds.get(source)!),
        ])
        if (!resolved || resolved.external) return resolved
        // 루트에서 찾은 것과 같은 파일일 때만 bare import로 넘김. 다르면(다른 버전)
        // Rollup이 지금까지처럼 직접 번들 → 버전이 섞이지 않음.
        if (resolved.id !== rootId) return resolved
        return { id: source, external: true }
      },
    },
    // 엔트리 맨 앞에서 prelude를 import → 다른 어떤 모듈보다 먼저 평가됨.
    // (Nitro의 폴리필 코드는 chunks/nitro/nitro.mjs 본문에 있어서, 그 청크가 import하는
    //  pg 같은 외부 패키지가 폴리필보다 먼저 실행되어 `Buffer is not defined`가 났음)
    renderChunk(code, chunk) {
      if (!chunk.isEntry || !preludePath) return null
      return { code: `import ${JSON.stringify(preludePath)};\n${code}`, map: null }
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
  // Nitro는 Rollup inject로 `Buffer`·`process`·`global` 같은 전역을 자기가 번들한
  // 코드에만 넣어준다. wrangler로 넘긴 패키지(pg 등)는 모듈 최상단에서 이 전역을 바로
  // 쓰므로, 같은 unenv 설정으로 전역을 먼저 채워두는 prelude 모듈을 만든다.
  const lines: string[] = env.polyfill.map(p => `import ${JSON.stringify(p)}`)
  Object.entries(env.inject).forEach(([name, spec], i) => {
    const [from, exp] = Array.isArray(spec) ? spec : [spec, 'default']
    const local = `__g${i}`
    lines.push(exp === 'default'
      ? `import ${local} from ${JSON.stringify(from)}`
      : `import { ${exp} as ${local} } from ${JSON.stringify(from)}`)
    lines.push(`if (globalThis.${name} === undefined) globalThis.${name} = ${local}`)
  })
  preludePath = join(shimDir, 'globals-prelude.mjs')
  writeFileSync(preludePath, `${lines.join('\n')}\n`)

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
    // Nitro의 workerd 폴리필(prelude가 import하는 process.mjs 등)은 원본 네이티브 모듈을
    // `#workerd/node:xxx`로 부름 → Nitro가 Rollup에서 하던 것처럼 node:xxx로 연결
    alias[`#workerd/node:${bare}`] = toPath(`node:${bare}`)
  }
  const cf = (nitro.options.cloudflare ||= {} as NonNullable<Nitro['options']['cloudflare']>)
  const wrangler = (cf.wrangler ||= {}) as { alias?: Record<string, string> }
  wrangler.alias = { ...alias, ...wrangler.alias }
}
