import type { KeptImageSourceDescriptor } from '../../../export'

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
  }
  return btoa(binary)
}

/**
 * Copies picked PNGs into project-owned storage and returns their managed descriptors. Bytes are
 * handed straight to the main process, so no image data is retained by the renderer.
 */
export async function uploadProjectPngs(files: File[]): Promise<KeptImageSourceDescriptor[]> {
  const pngs = files.filter((file) => file.name.toLowerCase().endsWith('.png'))
  if (pngs.length === 0) return []
  const payload = await Promise.all(
    pngs.map(async (file) => ({
      name: file.name,
      content: toBase64(new Uint8Array(await file.arrayBuffer()))
    }))
  )
  const saved = await window.studio.projectImages.save(payload)
  return saved.map((descriptor) => ({
    kind: 'uploaded-png' as const,
    ref: descriptor.ref,
    name: descriptor.name,
    naturalWidth: descriptor.width,
    naturalHeight: descriptor.height
  }))
}
