import type { KeptEntriesCanvasLayout, KeptImageSourceRef } from '../../../shared/keptEntriesLayout'
import type { ProjectState } from '../../../shared/contracts'
import { getProjectImageUrl, isProjectImageRef } from '../../../shared/projectImages'
import { generateEntryPngFiles, type EntryPngFile } from './entryImageExport'
import { renderTextLabelPng, type TextLabelImage } from './textLabelImage'

type BalanceLabelRenderer = (
  text: string,
  options: {
    fontSize: number
    color: string
    fontFamily?: string
    fontWeight?: string
    backgroundColor?: string
  }
) => TextLabelImage | undefined

/** Keys a placement's rendered running-balance PNG in the same map as its image data URL. */
export function keptImageBalanceRef(placementId: string): string {
  return `balance:${placementId}`
}

export type SessionImageGenerator = (
  project: ProjectState,
  readPdf: (path: string) => Promise<Uint8Array>
) => Promise<EntryPngFile[]>

export interface KeptSessionImageResult {
  urls: Map<string, string>
  error?: string
}

/** Unique, order-stable refs of one source kind, so callers can key work on the set itself. */
export function collectKeptImageRefs(
  layout: KeptEntriesCanvasLayout | undefined,
  kind: KeptImageSourceRef['kind']
): string[] {
  const refs = new Set<string>()
  for (const placement of layout?.images ?? []) {
    if (placement.source.kind === kind) refs.add(placement.source.ref)
  }
  return [...refs].sort()
}

/**
 * Display resolution: managed uploads stream over the privileged protocol rather than entering
 * React state, and session crops come from the transient map the caller regenerated.
 */
export function resolveKeptImageUrl(
  source: KeptImageSourceRef,
  sessionUrls: ReadonlyMap<string, string>
): string | undefined {
  if (source.kind === 'uploaded-png') {
    return isProjectImageRef(source.ref) ? getProjectImageUrl(source.ref) : undefined
  }
  return sessionUrls.get(source.ref)
}

/**
 * Regenerates the kept-entry crops a preview needs. Failure resolves to an empty map plus a
 * message so an unreadable source degrades to placeholders instead of breaking the editor.
 */
export async function loadKeptSessionImageUrls(
  project: ProjectState,
  refs: readonly string[],
  readPdf: (path: string) => Promise<Uint8Array>,
  generate: SessionImageGenerator = generateEntryPngFiles
): Promise<KeptSessionImageResult> {
  if (refs.length === 0) return { urls: new Map() }
  const wanted = new Set(refs)
  try {
    const files = await generate(project, readPdf)
    const urls = new Map<string, string>()
    for (const file of files) {
      if (file.entryId && wanted.has(file.entryId)) {
        urls.set(file.entryId, `data:image/png;base64,${file.content}`)
      }
    }
    return { urls }
  } catch (failure) {
    return {
      urls: new Map(),
      error: failure instanceof Error ? failure.message : 'Entry images could not be generated.'
    }
  }
}

/**
 * Layouts store image references only, so export resolves bytes on demand: uploads come from
 * project-owned storage and session entries are re-cropped from their source PDFs.
 */
export async function resolveKeptImageDataUrls(
  project: ProjectState,
  layout: KeptEntriesCanvasLayout | undefined,
  readPdf: (path: string) => Promise<Uint8Array>,
  generate: SessionImageGenerator = generateEntryPngFiles,
  renderBalanceLabel: BalanceLabelRenderer = renderTextLabelPng
): Promise<Map<string, string>> {
  const images = layout?.images ?? []
  const backgroundRef =
    layout?.background?.ref && isProjectImageRef(layout.background.ref)
      ? layout.background.ref
      : undefined
  if (images.length === 0 && !backgroundRef) return new Map()

  const resolved = new Map<string, string>()
  const uploadedRefs = [
    ...collectKeptImageRefs(layout, 'uploaded-png').filter(isProjectImageRef),
    ...(backgroundRef ? [backgroundRef] : [])
  ]
  if (uploadedRefs.length > 0) {
    const dataUrls = await window.studio.projectImages.readDataUrls(uploadedRefs)
    for (const [ref, dataUrl] of Object.entries(dataUrls)) resolved.set(ref, dataUrl)
  }

  const sessionRefs = collectKeptImageRefs(layout, 'session-entry')
  if (sessionRefs.length > 0) {
    const session = await loadKeptSessionImageUrls(project, sessionRefs, readPdf, generate)
    for (const [ref, dataUrl] of session.urls) resolved.set(ref, dataUrl)
  }

  const runningBalance = layout?.imagePlacementOptions?.runningBalance
  if (runningBalance?.enabled) {
    for (const placement of images) {
      if (!placement.runningBalanceText) continue
      const label = renderBalanceLabel(placement.runningBalanceText, {
        fontSize: runningBalance.fontSize,
        color: runningBalance.color,
        fontFamily: runningBalance.fontFamily,
        fontWeight: runningBalance.fontWeight,
        backgroundColor: runningBalance.backgroundColor
      })
      if (label) resolved.set(keptImageBalanceRef(placement.id), label.dataUrl)
    }
  }

  return resolved
}
