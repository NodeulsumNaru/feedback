import { imageMeta } from 'image-meta'

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const AVATAR_MAX_PIXELS = 24_000_000
export const AVATAR_MAX_EDGE = 512
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp'

export class AvatarValidationError extends Error {
  constructor(public code: 'invalidImage' | 'imageTooLarge' | 'imageTooManyPixels') {
    super(code)
  }
}

// Read actual file metadata; neither the filename nor the supplied MIME is trusted.
// This does not decode pixels. The browser decodes and re-encodes selections before upload.
export function inspectAvatar(bytes: Uint8Array) {
  if (bytes.byteLength > AVATAR_MAX_BYTES) throw new AvatarValidationError('imageTooLarge')
  try {
    const { width, height, type } = imageMeta(bytes)
    if (!type || !['jpg', 'png', 'webp'].includes(type)
      || !width || !height || !Number.isInteger(width) || !Number.isInteger(height)
      || width < 1 || height < 1) {
      throw new AvatarValidationError('invalidImage')
    }
    if (width * height > AVATAR_MAX_PIXELS) throw new AvatarValidationError('imageTooManyPixels')
    return { width, height, type, mime: type === 'jpg' ? 'image/jpeg' : `image/${type}` }
  }
  catch (error) {
    if (error instanceof AvatarValidationError) throw error
    throw new AvatarValidationError('invalidImage')
  }
}
