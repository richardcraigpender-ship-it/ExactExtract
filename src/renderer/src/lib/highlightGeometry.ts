import type { ProjectEntry, ProjectPage } from '../../../shared/contracts'
import { CANONICAL_LENGTH_UNIT, toPoints, type LengthUnit } from '../../../shared/units'

export type HighlightGeometryField = 'x' | 'y' | 'width' | 'height'

export type HighlightScope = 'entry' | 'selected' | 'keep' | 'all'

export type HighlightStyleMode = 'filled' | 'border'

export interface PageSize {
  width: number
  height: number
}

export interface HighlightGeometryEdit {
  field: HighlightGeometryField
  /** Absolute edits set the value outright; delta edits offset the current value. */
  mode: 'absolute' | 'delta'
  /** A length in `unit`, converted to PDF points before it is applied. */
  value: number
  unit?: LengthUnit
}

export interface HighlightScopeTarget {
  entryId: string
  regionIndex: number
}

const MIN_SIZE = 0.01

function clampRect(rect: { x: number; y: number; width: number; height: number }): {
  x: number
  y: number
  width: number
  height: number
} {
  const width = Math.min(1, Math.max(MIN_SIZE, rect.width))
  const height = Math.min(1, Math.max(MIN_SIZE, rect.height))
  return {
    x: Math.min(1 - width, Math.max(0, rect.x)),
    y: Math.min(1 - height, Math.max(0, rect.y)),
    width,
    height
  }
}

/**
 * Applies one geometry edit to a normalized rectangle, keeping the result inside the page.
 * Width/height edits shrink toward the origin rather than pushing the box off-page.
 *
 * Edits are applied in PDF user space so `y` is measured from the bottom of the page, matching
 * what the numbers in a PDF actually mean. Without a page size there is nothing to convert
 * against, so the rectangle is returned unchanged.
 */
export function applyGeometryEdit(
  rect: { x: number; y: number; width: number; height: number },
  edit: HighlightGeometryEdit,
  page?: PageSize
): { x: number; y: number; width: number; height: number } {
  if (!page || page.width <= 0 || page.height <= 0) return clampRect(rect)
  const points = toPoints(edit.value, edit.unit ?? CANONICAL_LENGTH_UNIT)
  const pdfRect = {
    x: rect.x * page.width,
    y: (1 - rect.y - rect.height) * page.height,
    width: rect.width * page.width,
    height: rect.height * page.height
  }
  const currentPoints = pdfRect[edit.field]
  const nextPoints = edit.mode === 'absolute' ? points : currentPoints + points
  const edited = { ...pdfRect, [edit.field]: nextPoints }
  return clampRect({
    x: edited.x / page.width,
    y: 1 - (edited.y + edited.height) / page.height,
    width: edited.width / page.width,
    height: edited.height / page.height
  })
}

/**
 * Resolves which regions an edit applies to. Only regions that already have a bounding box on
 * the supplied document are targeted, so scope changes can never invent geometry.
 */
export function resolveHighlightTargets(
  entries: readonly ProjectEntry[],
  options: {
    scope: HighlightScope
    documentId?: string
    pageNumber?: number
    selectedEntryId?: string | null
    selectedEntryIds?: ReadonlySet<string>
  }
): HighlightScopeTarget[] {
  const { scope, documentId, pageNumber, selectedEntryId, selectedEntryIds } = options

  const isInScope = (entry: ProjectEntry): boolean => {
    if (scope === 'entry') return entry.id === selectedEntryId
    if (scope === 'selected') return Boolean(selectedEntryIds?.has(entry.id))
    if (scope === 'keep') return entry.status === 'keep'
    return true
  }

  const targets: HighlightScopeTarget[] = []
  for (const entry of entries) {
    if (!isInScope(entry)) continue
    entry.regions.forEach((region, regionIndex) => {
      if (!region.bbox) return
      if (documentId !== undefined && region.documentId !== documentId) return
      if (pageNumber !== undefined && region.pageNumber !== pageNumber) return
      targets.push({ entryId: entry.id, regionIndex })
    })
  }
  return targets
}

function toNormalized(
  bbox: NonNullable<ProjectEntry['regions'][number]['bbox']>,
  page: ProjectPage | undefined
): { x: number; y: number; width: number; height: number } | null {
  if (bbox.coordinateSpace === 'normalized') {
    return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
  }
  if (!page || page.width <= 0 || page.height <= 0) return null
  return {
    x: bbox.x / page.width,
    y: 1 - (bbox.y + bbox.height) / page.height,
    width: bbox.width / page.width,
    height: bbox.height / page.height
  }
}

function fromNormalized(
  rect: { x: number; y: number; width: number; height: number },
  coordinateSpace: 'pdf-points' | 'normalized',
  page: ProjectPage | undefined
): NonNullable<ProjectEntry['regions'][number]['bbox']> | null {
  if (coordinateSpace === 'normalized') return { ...rect, coordinateSpace: 'normalized' }
  if (!page || page.width <= 0 || page.height <= 0) return null
  return {
    x: rect.x * page.width,
    y: (1 - rect.y - rect.height) * page.height,
    width: rect.width * page.width,
    height: rect.height * page.height,
    coordinateSpace: 'pdf-points'
  }
}

export interface HighlightGeometryResult {
  entries: ProjectEntry[]
  changedRegionCount: number
  changedEntryCount: number
}

/**
 * Applies a geometry edit to every targeted region, converting through each region's own
 * coordinate space so mixed normalized/pdf-points projects stay consistent.
 */
export function applyHighlightGeometry(
  entries: readonly ProjectEntry[],
  targets: readonly HighlightScopeTarget[],
  edit: HighlightGeometryEdit,
  pages: readonly ProjectPage[],
  updatedAt: string
): HighlightGeometryResult {
  if (targets.length === 0) {
    return { entries: [...entries], changedRegionCount: 0, changedEntryCount: 0 }
  }

  const targetsByEntry = new Map<string, Set<number>>()
  for (const target of targets) {
    const existing = targetsByEntry.get(target.entryId) ?? new Set<number>()
    existing.add(target.regionIndex)
    targetsByEntry.set(target.entryId, existing)
  }

  let changedRegionCount = 0
  let changedEntryCount = 0

  const nextEntries = entries.map((entry) => {
    const regionIndexes = targetsByEntry.get(entry.id)
    if (!regionIndexes) return entry

    let entryChanged = false
    const regions = entry.regions.map((region, regionIndex) => {
      if (!regionIndexes.has(regionIndex) || !region.bbox) return region

      const page = pages.find(
        (candidate) =>
          candidate.documentId === region.documentId && candidate.pageNumber === region.pageNumber
      )
      const normalized = toNormalized(region.bbox, page)
      if (!normalized) return region

      const updated = applyGeometryEdit(normalized, edit, page)
      const bbox = fromNormalized(updated, region.bbox.coordinateSpace, page)
      if (!bbox) return region

      entryChanged = true
      changedRegionCount += 1
      return { ...region, bbox }
    })

    if (!entryChanged) return entry
    changedEntryCount += 1
    return { ...entry, regions, updatedAt }
  })

  return { entries: nextEntries, changedRegionCount, changedEntryCount }
}

export function describeHighlightScope(count: number): string {
  if (count === 0) return 'No highlights match this scope.'
  return `${count} highlight${count === 1 ? '' : 's'} will be updated.`
}

/** A highlight's geometry in canonical PDF points. */
export interface HighlightMeasurements {
  x: number
  y: number
  width: number
  height: number
}

/**
 * `no-page-size` is reported separately because every unit is now a real length: without page
 * dimensions there is nothing to convert against, so numeric edits cannot be applied and the
 * panel has to say so rather than appear to work.
 */
export type HighlightMeasurement =
  | ({ status: 'measured' } & HighlightMeasurements)
  | { status: 'no-selection' }
  | { status: 'no-page-size' }

/**
 * Reads a region's current geometry so the panel can show what a "set to" edit would be
 * replacing, in the PDF's own bottom-up user space.
 */
export function measureHighlight(
  entries: readonly ProjectEntry[],
  target: HighlightScopeTarget | undefined,
  pages: readonly ProjectPage[]
): HighlightMeasurement {
  if (!target) return { status: 'no-selection' }
  const entry = entries.find((candidate) => candidate.id === target.entryId)
  const region = entry?.regions[target.regionIndex]
  if (!region?.bbox) return { status: 'no-selection' }

  const page = pages.find(
    (candidate) =>
      candidate.documentId === region.documentId && candidate.pageNumber === region.pageNumber
  )
  const normalized = toNormalized(region.bbox, page)
  if (!normalized) return { status: 'no-selection' }
  if (!page || page.width <= 0 || page.height <= 0) return { status: 'no-page-size' }

  return {
    status: 'measured',
    x: normalized.x * page.width,
    y: (1 - normalized.y - normalized.height) * page.height,
    width: normalized.width * page.width,
    height: normalized.height * page.height
  }
}
