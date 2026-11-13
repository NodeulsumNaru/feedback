import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { AVATAR_MAX_BYTES, AvatarValidationError, inspectAvatar } from '../shared/utils/avatar'

const fixture = (extension: string) => readFileSync(new URL(`./fixtures/avatar.${extension}`, import.meta.url))
const rejectsWith = (data: Uint8Array, code: AvatarValidationError['code']) => {
  assert.throws(() => inspectAvatar(data), error => error instanceof AvatarValidationError && error.code === code)
}

test('recognizes supported files from bytes without trusting a name or MIME', () => {
  for (const [extension, mime] of [['png', 'image/png'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']]) {
    const image = inspectAvatar(fixture(extension!))
    assert.equal(image.width, 2)
    assert.equal(image.height, 3)
    assert.equal(image.mime, mime)
  }
})

test('rejects empty, truncated and non-image input', () => {
  for (const data of [new Uint8Array(), fixture('png').subarray(0, 12), new TextEncoder().encode('not an image')]) {
    rejectsWith(data, 'invalidImage')
  }
})

test('does not accept SVG or GIF as avatars', () => {
  rejectsWith(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>'), 'invalidImage')
  rejectsWith(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'), 'invalidImage')
})

test('limits bytes independently of declared dimensions', () => {
  const bytes = new Uint8Array(AVATAR_MAX_BYTES + 1)
  bytes.set(fixture('png'))
  rejectsWith(bytes, 'imageTooLarge')
})

test('rejects excessive pixel counts before any pixel decode', () => {
  const bytes = fixture('png')
  bytes.writeUInt32BE(6000, 16)
  bytes.writeUInt32BE(4001, 20)
  rejectsWith(bytes, 'imageTooManyPixels')
})

test('rejects zero dimensions', () => {
  const bytes = fixture('png')
  bytes.writeUInt32BE(0, 16)
  rejectsWith(bytes, 'invalidImage')
})
