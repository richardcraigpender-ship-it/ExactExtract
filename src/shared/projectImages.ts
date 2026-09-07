export const PROJECT_IMAGE_SCHEME = 'exact-extract-image'
export const PROJECT_IMAGE_HOST = 'project-images'
export const PROJECT_IMAGE_BASE_URL = `${PROJECT_IMAGE_SCHEME}://${PROJECT_IMAGE_HOST}`

/** Managed refs are content addressed, so the name is a SHA-256 digest and never user supplied. */
const PROJECT_IMAGE_REF_PATTERN = /^[\da-f]{64}\.(?:png|jpg|webp)$/

const PROJECT_IMAGE_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp'
}

export interface ProjectImageDescriptor {
  ref: string
  name: string
  width: number
  height: number
  byteLength: number
}

export function isProjectImageRef(ref: string): boolean {
  return PROJECT_IMAGE_REF_PATTERN.test(ref)
}

export function getProjectImageMimeType(ref: string): string {
  return PROJECT_IMAGE_MIME_TYPES[ref.split('.').pop() ?? ''] ?? 'application/octet-stream'
}

export function getProjectImageUrl(ref: string): string {
  if (!isProjectImageRef(ref)) throw new Error('Invalid project image reference.')
  return `${PROJECT_IMAGE_BASE_URL}/${ref}`
}
