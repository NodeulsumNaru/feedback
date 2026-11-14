import { AVATAR_MAX_BYTES, AVATAR_MAX_EDGE, AvatarValidationError, inspectAvatar } from '#layers/feedlog/shared/utils/avatar'

// Account avatars are shared across organizations. Keep their keys user-scoped.
export default defineEventHandler(async (event) => {
  const { user } = await requireLocalSession(event)
  const tooLarge = () => createError({ statusCode: 413, message: 'Avatar exceeds 5 MB', data: { code: 'imageTooLarge' } })
  if (Number(getHeader(event, 'content-length')) > AVATAR_MAX_BYTES) throw tooLarge()
  const reader = getRequestWebStream(event)?.getReader()
  if (!reader) throw createError({ statusCode: 400, message: 'Image required' })

  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > AVATAR_MAX_BYTES) {
        await reader.cancel()
        throw tooLarge()
      }
      chunks.push(value)
    }
  }
  finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  let metadata
  try {
    metadata = inspectAvatar(bytes)
    if (metadata.width > AVATAR_MAX_EDGE || metadata.height > AVATAR_MAX_EDGE) {
      throw new AvatarValidationError('imageTooManyPixels')
    }
  }
  catch (error) {
    if (!(error instanceof AvatarValidationError)) throw error
    throw createError({ statusCode: 400, message: 'Invalid avatar', data: { code: error.code } })
  }

  const uploadPrefix = process.env.UPLOAD_PREFIX || process.env.NUXT_PUBLIC_UPLOAD_PREFIX || useRuntimeConfig().public.uploadPrefix
  const file = await blobStorage.put(`avatar.${metadata.type}`, new Blob([bytes], { type: metadata.mime }), {
    addRandomSuffix: true,
    prefix: `${uploadPrefix}/avatars/${encodeURIComponent(user.id)}/`,
  })
  return { key: file.pathname }
})
