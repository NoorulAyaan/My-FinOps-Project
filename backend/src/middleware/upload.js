import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import multer from 'multer'
import { config } from '../config.js'
import { badRequest } from '../errors.js'

/**
 * Avatar uploads.
 *
 * The file is memory-stored and size-capped by Multer, then written under a
 * generated name. The original filename is never used on disk, so a hostile
 * name cannot traverse out of the uploads directory, and the magic bytes are
 * checked rather than trusting the declared MIME type or the extension.
 */

// Extensions are derived from the sniffed content type, not from what the
// client claimed, so a .html upload cannot be stored as a .png and later
// served as an executable document.
const CONTENT_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const ALLOWED_AVATAR_TYPES = Object.keys(CONTENT_TYPES)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.avatarMaxBytes, files: 1 },
})

/** Wraps Multer so its errors surface as ApiError rather than a 500. */
export function avatarUpload(req, res, next) {
  upload.single('avatar')(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = Math.round(config.uploads.avatarMaxBytes / (1024 * 1024))
      return next(badRequest(`Image must be smaller than ${mb} MB.`))
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(badRequest('Send the image as the "avatar" field.'))
    }
    return next(badRequest('That file could not be uploaded.'))
  })
}

/**
 * Identifies an image from its leading bytes. A declared content-type is only
 * ever a hint, so the bytes decide.
 */
function sniffImageType(buffer) {
  if (buffer.length < 12) return null
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  // JPEG: SOI marker then FF D8 FF.
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  if (buffer.subarray(0, 3).toString('ascii') === 'GIF' && buffer[2] === 0x39) return 'image/gif'
  return null
}

/**
 * Validates an uploaded avatar and writes it to disk, returning the filename to
 * store on the user row.
 */
export async function storeAvatar(file) {
  if (!file?.buffer?.length) throw badRequest('Choose an image to upload.')
  if (!ALLOWED_AVATAR_TYPES.includes(file.mimetype)) {
    throw badRequest('Use a PNG, JPEG, WebP or GIF image.')
  }

  const sniffed = sniffImageType(file.buffer)
  if (!sniffed) throw badRequest('That file is not a readable image.')

  const ext = CONTENT_TYPES[sniffed]
  const filename = `${crypto.randomUUID()}.${ext}`

  await fs.mkdir(config.uploads.avatarDir, { recursive: true })
  await fs.writeFile(path.join(config.uploads.avatarDir, filename), file.buffer, { mode: 0o640 })

  return filename
}
