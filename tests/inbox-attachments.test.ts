import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp, createRouter, createError, defineEventHandler, getHeader, getRouterParam, toWebHandler } from 'h3'

// Exercise the actual route handlers with an in-memory blob provider.
const uploads = new Map<string, string>()
Object.assign(globalThis, {
  createError, defineEventHandler, getRouterParam,
  useRuntimeConfig: () => ({ public: { uploadPrefix: 'uploads' } }),
  requireAuth: async (event: Parameters<typeof getHeader>[0]) => {
    if (!getHeader(event, 'authorization')) throw createError({ statusCode: 401 })
  },
  blobStorage: {
    async handleUpload(_event: unknown, options: { put: { prefix: string } }) {
      const pathname = `${options.put.prefix}image.png`
      uploads.set(pathname, 'synthetic image')
      return [{ pathname }]
    },
    async serve(_event: unknown, path: string) {
      if (!uploads.has(path)) throw createError({ statusCode: 404 })
      return uploads.get(path)
    },
  },
})
const { default: upload } = await import('../server/api/upload.post')
const { default: files } = await import('../server/api/files/[...path].get')
const app = createApp()
app.use(defineEventHandler(event => { event.context.orgId = 'org' }))
app.use(createRouter().post('/api/upload', upload).get('/api/files/**:path', files).handler)
const request = toWebHandler(app)

test('conversation uploads keep the existing organization path and are readable without publication or a session', async () => {
  const unauthenticated = await request(new Request('http://local/api/upload', { method: 'POST' }))
  assert.equal(unauthenticated.status, 401)
  const result = await request(new Request('http://local/api/upload', { method: 'POST', headers: { authorization: 'synthetic-session' } }))
  assert.equal(result.status, 200)
  const { key } = await result.json()
  const prefix = process.env.UPLOAD_PREFIX || process.env.NUXT_PUBLIC_UPLOAD_PREFIX || 'uploads'
  assert.equal(key, `${prefix}/org/image.png`)
  const image = await request(new Request(`http://local/api/files/${key}`))
  assert.equal(image.status, 200)
  assert.equal(await image.text(), 'synthetic image')
})

test('existing Inbox attachment paths use the same file proxy without adding an access policy', async () => {
  const key = 'uploads/org/private/old-customer/image.png'
  uploads.set(key, 'existing image')
  const image = await request(new Request(`http://local/api/files/${key}`))
  assert.equal(image.status, 200)
  assert.equal(await image.text(), 'existing image')
})
