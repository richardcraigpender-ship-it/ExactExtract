import type { KeptEntriesBackground } from '../../../shared/keptEntriesLayout'
import type { KeptExportTemplate } from '../../../shared/keptExportTemplate'
import { getProjectImageUrl, isProjectImageRef } from '../../../shared/projectImages'

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i

/** Display source for a background, preferring managed storage over legacy inline bytes. */
export function resolveBackgroundUrl(
  background: KeptEntriesBackground | undefined
): string | undefined {
  if (!background) return undefined
  if (background.ref && isProjectImageRef(background.ref)) {
    return getProjectImageUrl(background.ref)
  }
  return background.dataUrl
}

/** Every managed ref a project depends on for backgrounds, so export can resolve bytes once. */
export function collectBackgroundRefs(
  backgrounds: readonly (KeptEntriesBackground | undefined)[]
): string[] {
  const refs = new Set<string>()
  for (const background of backgrounds) {
    if (background?.ref && isProjectImageRef(background.ref)) refs.add(background.ref)
  }
  return [...refs]
}

/**
 * Copies a picked background into managed storage and returns a ref-only record, so image bytes
 * never reach the project file.
 */
export async function storeBackgroundImage(
  dataUrl: string,
  geometry: Omit<KeptEntriesBackground, 'ref' | 'dataUrl'>
): Promise<KeptEntriesBackground> {
  const match = DATA_URL_PATTERN.exec(dataUrl)
  if (!match) throw new Error('Background must be a PNG, JPEG, or WebP image.')
  const { ref } = await window.studio.projectImages.saveBackground(match[2])
  return { ref, ...geometry }
}

/** Both page templates can carry their own background, so export resolves each ref once. */
export async function resolveTemplateBackgroundDataUrls(
  template: KeptExportTemplate
): Promise<Map<string, string>> {
  const refs = collectBackgroundRefs([
    template.pageOneTemplate.background,
    template.laterPagesTemplate.background
  ])
  if (refs.length === 0) return new Map()
  return new Map(Object.entries(await window.studio.projectImages.readDataUrls(refs)))
}

/**
 * Moves a legacy inline background into managed storage. Returns the original when it is already
 * a ref, so callers can detect "nothing changed" by identity.
 */
export async function migrateLegacyBackground(
  background: KeptEntriesBackground | undefined
): Promise<KeptEntriesBackground | undefined> {
  if (!background?.dataUrl || background.ref) return background
  const { dataUrl, ...geometry } = background
  try {
    return await storeBackgroundImage(dataUrl, geometry)
  } catch {
    return background
  }
}
