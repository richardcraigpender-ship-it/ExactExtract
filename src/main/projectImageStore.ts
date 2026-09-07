import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import {
  getProjectImageMimeType,
  isProjectImageRef,
  type ProjectImageDescriptor
} from '../shared/projectImages'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MAX_FILE_COUNT = 500
const MAX_IMAGE_BYTES = 25 * 1024 * 1024

export type ProjectImageFormat = 'png' | 'jpg' | 'webp'

/** Signature sniffing only; backgrounds never need their intrinsic size, so no decoder is used. */
export function detectProjectImageFormat(bytes: Buffer): ProjectImageFormat {
  if (bytes.byteLength >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png'
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg'
  }
  if (
    bytes.byteLength >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp'
  }
  throw new Error('Image must be a PNG, JPEG, or WebP file.')
}

export interface ProjectImageUpload {
  name: string
  content: string
}

/** Reads the IHDR header so the main process never needs an image decoder. */
export function readPngDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.byteLength < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Uploaded image is not a PNG.')
  }
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error('Uploaded PNG is missing its header.')
  }
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (!(width > 0) || !(height > 0)) throw new Error('Uploaded PNG has no usable size.')
  return { width, height }
}

export function validateProjectImageUploads(value: unknown): ProjectImageUpload[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('At least one PNG file is required.')
  }
  if (value.length > MAX_FILE_COUNT) throw new Error('Too many PNG files were selected.')
  return value.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('PNG upload is invalid.')
    const upload = item as Record<string, unknown>
    if (typeof upload.name !== 'string' || upload.name.length === 0) {
      throw new Error('PNG upload name is required.')
    }
    if (typeof upload.content !== 'string') throw new Error('PNG upload content must be base64.')
    return { name: upload.name, content: upload.content }
  })
}

export class ProjectImageStore {
  constructor(private readonly root: string) {}

  private pathFor(ref: string): string {
    if (!isProjectImageRef(ref)) throw new Error('Invalid project image reference.')
    const resolvedRoot = resolve(this.root)
    const resolvedPath = resolve(resolvedRoot, ref)
    if (resolvedPath !== join(resolvedRoot, ref)) {
      throw new Error('Invalid project image reference.')
    }
    return resolvedPath
  }

  async save(value: unknown): Promise<ProjectImageDescriptor[]> {
    const uploads = validateProjectImageUploads(value)
    await mkdir(this.root, { recursive: true })
    const described = uploads.map((upload) => this.describe(upload))
    // Identical PNGs share one content-addressed destination, so a batch must not race itself:
    // write each distinct ref exactly once and let every upload report the same reference.
    const distinct = new Map<string, Buffer>()
    for (const item of described) {
      if (!distinct.has(item.ref)) distinct.set(item.ref, item.bytes)
    }
    await Promise.all([...distinct].map(([ref, bytes]) => this.persist(ref, bytes)))
    return described.map(({ ref, name, width, height, byteLength }) => ({
      ref,
      name,
      width,
      height,
      byteLength
    }))
  }

  private describe(upload: ProjectImageUpload): ProjectImageDescriptor & { bytes: Buffer } {
    const bytes = Buffer.from(upload.content, 'base64')
    if (bytes.byteLength > MAX_IMAGE_BYTES)
      throw new Error(`${upload.name} exceeds the 25 MB limit.`)
    const { width, height } = readPngDimensions(bytes)
    const ref = `${createHash('sha256').update(bytes).digest('hex')}.png`
    return { ref, name: upload.name, width, height, byteLength: bytes.byteLength, bytes }
  }

  /**
   * Backgrounds are stored by content like uploads, but accept JPEG and WebP and skip the
   * dimension read: a background always carries explicit page coordinates.
   */
  async saveBackground(value: unknown): Promise<{ ref: string; byteLength: number }> {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error('Background image content must be base64.')
    }
    const bytes = Buffer.from(value, 'base64')
    if (bytes.byteLength === 0) throw new Error('Background image is empty.')
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Background exceeds the 25 MB limit.')
    const format = detectProjectImageFormat(bytes)
    const ref = `${createHash('sha256').update(bytes).digest('hex')}.${format}`
    await mkdir(this.root, { recursive: true })
    await this.persist(ref, bytes)
    return { ref, byteLength: bytes.byteLength }
  }

  private async persist(ref: string, bytes: Buffer): Promise<void> {
    const target = this.pathFor(ref)
    if (await this.exists(target)) return
    const pending = `${target}.${randomUUID()}.tmp`
    await writeFile(pending, bytes)
    try {
      await rename(pending, target)
    } catch (error) {
      // A concurrent writer can claim the destination first; Windows rejects the loser outright.
      // The ref is a digest of these exact bytes, so an existing file is already the right content.
      await rm(pending, { force: true })
      if (!(await this.exists(target))) throw error
    }
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await stat(path)
      return true
    } catch {
      return false
    }
  }

  async read(ref: string): Promise<Buffer> {
    return readFile(this.pathFor(ref))
  }

  async readDataUrls(refs: readonly string[]): Promise<Record<string, string>> {
    const resolved: Record<string, string> = {}
    await Promise.all(
      refs.filter(isProjectImageRef).map(async (ref) => {
        try {
          const bytes = await this.read(ref)
          resolved[ref] = `data:${getProjectImageMimeType(ref)};base64,${bytes.toString('base64')}`
        } catch {
          // A missing managed file is reported by the export warning path, not here.
        }
      })
    )
    return resolved
  }

  resolvePath(ref: string): string {
    return this.pathFor(ref)
  }
}
