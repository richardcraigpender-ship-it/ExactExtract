import { readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { isProjectImageRef } from '../shared/projectImages'

export interface ProjectImagePruneResult {
  kept: number
  removed: string[]
}

/** Collects the managed refs an already-parsed project JSON depends on. */
export function collectProjectImageRefs(project: unknown): string[] {
  if (typeof project !== 'object' || project === null) return []
  const refs: string[] = []
  const record = project as Record<string, unknown>

  const addBackgroundRef = (value: unknown): void => {
    const ref = (value as { ref?: unknown } | null)?.ref
    if (typeof ref === 'string' && isProjectImageRef(ref)) refs.push(ref)
  }

  const layout = record.keptEntriesLayout
  if (typeof layout === 'object' && layout !== null) {
    const images = (layout as { images?: unknown }).images
    if (Array.isArray(images)) {
      for (const image of images) {
        const source = (image as { source?: unknown } | null)?.source
        if (typeof source !== 'object' || source === null) continue
        const { kind, ref } = source as { kind?: unknown; ref?: unknown }
        if (kind === 'uploaded-png' && typeof ref === 'string' && isProjectImageRef(ref)) {
          refs.push(ref)
        }
      }
    }
    addBackgroundRef((layout as { background?: unknown }).background)
  }

  const template = record.keptExportTemplate
  if (typeof template === 'object' && template !== null) {
    for (const key of ['pageOneTemplate', 'laterPagesTemplate']) {
      const page = (template as Record<string, unknown>)[key]
      if (typeof page === 'object' && page !== null) {
        addBackgroundRef((page as { background?: unknown }).background)
      }
    }
  }

  return refs
}

async function readReferencedRefs(projectsDirectory: string): Promise<Set<string>> {
  const names = await readdir(projectsDirectory)
  const referenced = new Set<string>()
  for (const name of names) {
    if (!name.endsWith('.json') || name.startsWith('.')) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(await readFile(join(projectsDirectory, name), 'utf8')) as unknown
    } catch {
      // An unreadable project is treated as authoritative: see the throw below.
      throw new Error(`Project file could not be read during image retention: ${name}`)
    }
    for (const ref of collectProjectImageRefs(parsed)) referenced.add(ref)
  }
  return referenced
}

/**
 * Deletes managed PNGs no stored project references, plus interrupted `.tmp` writes. Any failure to
 * establish the complete reference set aborts without deleting, so an unreadable project can never
 * cost a user their images.
 */
export async function pruneProjectImages(
  imagesDirectory: string,
  projectsDirectory: string
): Promise<ProjectImagePruneResult> {
  let stored: string[]
  try {
    stored = await readdir(imagesDirectory)
  } catch {
    return { kept: 0, removed: [] }
  }

  const referenced = await readReferencedRefs(projectsDirectory)
  const removed: string[] = []
  let kept = 0
  for (const name of stored) {
    const isOrphanedImage = isProjectImageRef(name) && !referenced.has(name)
    if (!isOrphanedImage && !name.endsWith('.tmp')) {
      kept += 1
      continue
    }
    await rm(join(imagesDirectory, name), { force: true })
    removed.push(name)
  }
  return { kept, removed }
}
