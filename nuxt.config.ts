// https://nuxt.com/docs/api/configuration/nuxt-config
import { createResolver } from '@nuxt/kit'

const resolver = createResolver(import.meta.url)

export default defineNuxtConfig({
  // `$meta.name` makes Nuxt auto-generate a `#layers/feedlog` alias pointing
  // at this layer's rootDir, whether this project runs standalone (`cd` in,
  // `pnpm dev`) or is embedded as a consumer's layer (e.g. under
  // `<your-app>/layers/feedlog/`). Official:
  // https://nuxt.com/docs/4.x/guide/going-further/layers
  //
  // Required for the standalone case — in the consumer case Nuxt's
  // auto-scan of `~~/layers/<dirname>/` would also generate the same alias
  // from the directory name, but we keep `$meta.name` explicit so standalone
  // runs don't break and the layer's identity isn't tied to a particular
  // directory name.
  $meta: { name: 'feedlog' },

  compatibilityDate: '2025-07-15',
  // devtools는 로컬 개발용이라 배포 빌드엔 필요 없음. 게다가 @nuxthub/core의
  // devtools 통합이 Prisma Studio(@prisma/client, @prisma/studio-core,
  // @electric-sql/pglite 등 100MB+)를 끌고 들어오는데, cloudflare-module
  // Nitro 번들링 단계에서 이게 같이 딸려 들어가면서 OOM(heap out of memory)의
  // 주범이었음. 프로덕션 빌드에서는 꺼서 이 무거운 의존성 체인 자체를 빼버림.
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  // NOTE: `#shared` is owned by the active Nuxt instance (the consumer), so
  // a downstream app extending this layer can place its own `shared/types/*`
  // and import via `#shared/`. This layer's own layer-local references go
  // through `#layers/feedlog/...` (auto-generated from $meta.name above).

  // app/stores/ is NOT in Nuxt's layer auto-merge list, so when feedlog is
  // consumed as a layer, `useBoardStore` etc. would not auto-import. Force
  // registration with an absolute path so Pinia stores work in both standalone
  // and extended contexts.
  imports: {
    dirs: [resolver.resolve('./app/stores')],
  },

  app: {
    head: {
      // Keyed so a configured org logo can override every icon slot at runtime
      // (app.vue). type/sizes are intentionally omitted: unhead merges keyed
      // tags by union, so any hint here would leak onto the override and
      // mislabel a logo of a different format. The browser sniffs the served
      // content-type either way.
      link: [
        { key: 'favicon-svg', rel: 'icon', href: '/logo.svg' },
        { key: 'favicon-png', rel: 'icon', href: '/favicon.png' },
        { key: 'favicon-ico', rel: 'shortcut icon', href: '/favicon.ico' },
        { key: 'favicon-apple', rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

  site: {
    name: 'FeedLog',
  },

  components: [
    { path: resolver.resolve('./app/components'), pathPrefix: false },
  ],

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxtjs/i18n',
    '@nuxtjs/seo',
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
    'shadcn-nuxt',
    '@nuxthub/core',
    // CF-only bootstrap module: adds a /setup page + /api/_migrate endpoints
    // so the one-click Cloudflare Deploy Button can finish DB migrations on
    // first request. All handlers no-op (404) under non-CF presets.
    // Resolver path keeps layer-consumer usage working.
    resolver.resolve('./modules/cf-setup/module'),
    // Node / Docker only: registers an S3-compatible blob provider at
    // runtime when S3_* env vars are set. Skipped on cloudflare-module
    // and vercel presets where NuxtHub's R2 / Vercel Blob driver applies.
    resolver.resolve('./modules/blob-s3/module'),
    resolver.resolve('./modules/widget-preload/module'),
  ],
  shadcn: {
    prefix: '',
    componentDir: resolver.resolve('./app/components/ui'),
  },
  fonts: {
    families: [
      {
        name: 'Inter',
        provider: 'google',
        weights: [400, 500, 600, 700],
      },
    ],
  },
  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    vueI18n: 'i18n.config.ts',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'feedlog_locale',
      redirectOn: 'root',
    },
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'ko', language: 'ko-KR', name: '한국어', file: 'ko.json' },
      { code: 'zh', language: 'zh-CN', name: '中文', file: 'zh.json' },
    ],
  },
  hub: {
    blob: true,
  },

  // The widget frame's identity rides in the URL fragment, which never reaches
  // the server, so a server render can only produce an empty shell — one the
  // visitor never sees, because the SDK keeps the frame hidden until it reports
  // ready. Rendering it costs ~290ms of TTFB and a hydration pass on top.
  //
  // That shell is the same bytes for everyone opening the frame on a host, so
  // it is worth caching — but briefly: a deploy rotates the asset hashes the
  // shell points at, and a stale one asks for chunks the new image never built.
  routeRules: {
    '/widget/embed': {
      ssr: false,
      headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=600' },
    },
    '/*/widget/embed': {
      ssr: false,
      headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=600' },
    },
  },

  icon: {
    // Everything the widget frame draws. Bundled because the frame otherwise
    // fetches two icon collections over HTTP while the visitor waits.
    clientBundle: {
      icons: [
        'lucide:alert-circle',
        'lucide:arrow-left',
        'lucide:arrow-up-right',
        'lucide:chevron-up',
        'lucide:globe',
        'lucide:image',
        'lucide:inbox',
        'lucide:loader-2',
        'lucide:message-circle',
        'lucide:x',
      ],
    },
  },

  build: {
    transpile: ['reka-ui'],
  },

  nitro: {
    // Keep CF Workers' native node:fs / path / process available at runtime so
    // the cf-setup module can read bundled migration files via `/bundle/...`.
    // Without this, Nitro's unenv stub shadows them, reads return empty, and
    // the state classifier never leaves `bootstrap`.
    unenv: {
      external: ['node:fs', 'node:fs/promises', 'node:path', 'node:process'],
    },
    // Cloudflare Workers Builds에서 "Building Nuxt Nitro server (preset:
    // cloudflare-module...)" 단계에서 OOM이 났던 진짜 원인은 devtools가 끌고
    // 오는 Prisma Studio 관련 의존성이었음(위 devtools 옵션 참고). 압축/소스맵은
    // 그래도 가벼운 안전장치로 꺼둠.
    // Nitro의 기본 node-externals 플러그인에 캐싱 버그가 있어서(nitrojs/nitro#2369),
    // 무거운 의존성이 많을 때 모듈 해석이 계속 캐시를 못 맞추고 반복되면서
    // 메모리 사용량이 기하급수적으로 늘어남 - 이게 cloudflare-module 번들링
    // 단계에서 OOM(heap out of memory) 나던 진짜 근본 원인이었음.
    experimental: {
      legacyExternals: true,
    },
    minify: false,
    sourceMap: false,
  },

  vite: {
    ssr: {
      // Exclude md-editor-v3 from SSR bundle — it's browser-only and very large (~2MB)
      external: ['md-editor-v3'],
    },
    build: {
      // Cloudflare Workers Builds에서 빌드 중 OOM(heap out of memory)이 나서,
      // 메모리를 꽤 잡아먹는 소스맵 생성을 프로덕션 빌드에서는 끔.
      sourcemap: false,
    },
  },

  sourcemap: {
    server: false,
    client: false,
  },

  ogImage: {
    enabled: false,
  },

  runtimeConfig: {
    public: {
      uploadPrefix: process.env.NUXT_PUBLIC_UPLOAD_PREFIX || 'uploads',
    },
  },
})
