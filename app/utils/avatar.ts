import { AVATAR_MAX_BYTES, AVATAR_MAX_EDGE, AVATAR_MAX_PIXELS, AvatarValidationError, inspectAvatar } from '#layers/feedlog/shared/utils/avatar'

export async function prepareAvatar(file: File): Promise<Blob> {
  if (file.size > AVATAR_MAX_BYTES) throw new AvatarValidationError('imageTooLarge')
  const metadata = inspectAvatar(new Uint8Array(await file.arrayBuffer()))
  const url = URL.createObjectURL(new Blob([file], { type: metadata.mime }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const { naturalWidth: width, naturalHeight: height } = image
    if (!width || !height) throw new AvatarValidationError('invalidImage')
    if (width * height > AVATAR_MAX_PIXELS) throw new AvatarValidationError('imageTooManyPixels')
    const scale = Math.min(1, AVATAR_MAX_EDGE / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new AvatarValidationError('invalidImage')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new AvatarValidationError('invalidImage')
    return blob
  }
  finally {
    URL.revokeObjectURL(url)
  }
}
