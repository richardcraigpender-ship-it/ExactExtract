import type { ProjectEntry, SourceRegion } from '../shared/contracts'

function cloneRegion(region: SourceRegion): SourceRegion {
  return {
    ...region,
    ...(region.bbox ? { bbox: { ...region.bbox } } : {})
  }
}

function regionKey(region: SourceRegion): string {
  const bbox = region.bbox
  return [
    region.documentId,
    region.pageNumber,
    bbox?.coordinateSpace ?? '',
    bbox?.x ?? '',
    bbox?.y ?? '',
    bbox?.width ?? '',
    bbox?.height ?? '',
    region.blockId ?? '',
    region.tableId ?? '',
    region.rowIndex ?? ''
  ].join(':')
}

function uniqueRegions(entries: readonly ProjectEntry[]): SourceRegion[] {
  const regions = new Map<string, SourceRegion>()
  for (const entry of entries) {
    for (const region of entry.regions) regions.set(regionKey(region), cloneRegion(region))
  }
  return [...regions.values()].sort(
    (left, right) =>
      left.documentId.localeCompare(right.documentId) ||
      left.pageNumber - right.pageNumber ||
      (right.bbox?.y ?? 0) - (left.bbox?.y ?? 0) ||
      (left.bbox?.x ?? 0) - (right.bbox?.x ?? 0)
  )
}

export function findPreferredSourceRegion(
  entry: ProjectEntry | undefined,
  documentId: string | undefined,
  pageNumber: number
): SourceRegion | undefined {
  if (!entry) return undefined
  return (
    entry.regions.find(
      (region) => region.documentId === documentId && region.pageNumber === pageNumber
    ) ??
    entry.regions.find((region) => region.documentId === documentId) ??
    entry.regions[0]
  )
}

function requireIsoTimestamp(value: string, name: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${name} must be an ISO date.`)
}

function contentHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function mergeReviewEntries(entries: readonly ProjectEntry[]): ProjectEntry {
  if (entries.length < 2) throw new Error('At least two entries are required to merge.')
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new Error('Entries to merge must have unique IDs.')
  }
  const status = entries[0]?.status
  if (!status || entries.some((entry) => entry.status !== status)) {
    throw new Error('Entries with different review statuses cannot be merged.')
  }

  const ordered = [...entries].sort((left, right) => {
    const leftRegion = left.regions[0]
    const rightRegion = right.regions[0]
    return (
      (leftRegion?.documentId ?? '').localeCompare(rightRegion?.documentId ?? '') ||
      (leftRegion?.pageNumber ?? 0) - (rightRegion?.pageNumber ?? 0) ||
      (rightRegion?.bbox?.y ?? 0) - (leftRegion?.bbox?.y ?? 0) ||
      (leftRegion?.bbox?.x ?? 0) - (rightRegion?.bbox?.x ?? 0) ||
      left.id.localeCompare(right.id)
    )
  })
  const categories = [...new Set(ordered.map((entry) => entry.category).filter(Boolean))]
  const dates = [...new Set(ordered.map((entry) => entry.date).filter(Boolean))]
  const numericValues = [
    ...new Set(ordered.map((entry) => entry.numericValue).filter((value) => value !== undefined))
  ]
  const notes = ordered.map((entry) => entry.notes?.trim()).filter(Boolean)

  return {
    id: `review-merge:${entries
      .map((entry) => entry.id)
      .sort()
      .join('|')}`,
    rawText: ordered.map((entry) => entry.rawText).join('\n'),
    normalizedText: ordered.map((entry) => entry.normalizedText).join('\n'),
    source: entries.every((entry) => entry.source === entries[0]?.source)
      ? entries[0]!.source
      : 'merged',
    status,
    confidence: ordered.reduce((total, entry) => total + entry.confidence, 0) / ordered.length,
    regions: uniqueRegions(ordered),
    ...(categories.length === 1 ? { category: categories[0] } : {}),
    ...(numericValues.length === 1 ? { numericValue: numericValues[0] } : {}),
    ...(dates.length === 1 ? { date: dates[0] } : {}),
    ...(notes.length > 0 ? { notes: notes.join('\n') } : {}),
    tags: [...new Set(ordered.flatMap((entry) => entry.tags))].sort(),
    createdAt: ordered.map((entry) => entry.createdAt).sort()[0]!,
    updatedAt: ordered
      .map((entry) => entry.updatedAt)
      .sort()
      .at(-1)!
  }
}

export function splitReviewEntry(entry: ProjectEntry, parts: readonly string[]): ProjectEntry[] {
  const normalizedParts = parts.map((part) => part.replace(/\s+/g, ' ').trim())
  if (normalizedParts.length < 2 || normalizedParts.some((part) => part.length === 0)) {
    throw new Error('At least two non-empty parts are required to split an entry.')
  }
  if (
    new Set(normalizedParts.map((part) => part.toLocaleLowerCase())).size !== normalizedParts.length
  ) {
    throw new Error('Split parts must be unique.')
  }
  requireIsoTimestamp(entry.createdAt, 'entry.createdAt')
  requireIsoTimestamp(entry.updatedAt, 'entry.updatedAt')

  return normalizedParts.map((part, index) => ({
    ...entry,
    id: `${entry.id}:split:${index + 1}:${contentHash(part)}`,
    rawText: entry.rawText,
    normalizedText: part,
    regions: entry.regions.map(cloneRegion),
    tags: [...entry.tags]
  }))
}

export function parseSplitParts(value: string): string[] {
  return value
    .split(/\r?\n|\s*[;|]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export interface ReconciledReviewSelection {
  selectedIds: Set<string>
  primaryId: string | null
}

export function reconcileReviewSelection(
  entries: readonly ProjectEntry[],
  selectedIds: ReadonlySet<string>,
  primaryId: string | null
): ReconciledReviewSelection {
  const availableIds = new Set(entries.map((entry) => entry.id))
  const nextSelected = new Set([...selectedIds].filter((id) => availableIds.has(id)))
  const nextPrimary =
    primaryId && availableIds.has(primaryId)
      ? primaryId
      : (nextSelected.values().next().value ?? entries[0]?.id ?? null)
  return { selectedIds: nextSelected, primaryId: nextPrimary }
}

// Higher pdf-points y is physically higher on the page; normalized y is already top-down.
function regionVisualTop(region: SourceRegion): number | undefined {
  const bbox = region.bbox
  if (!bbox) return undefined
  return bbox.coordinateSpace === 'pdf-points' ? -(bbox.y + bbox.height) : bbox.y
}

export function findEntryDirectlyAbove(
  entry: ProjectEntry,
  entries: readonly ProjectEntry[]
): ProjectEntry | undefined {
  const region = entry.regions[0]
  const top = region && regionVisualTop(region)
  if (!region || top === undefined) return undefined

  let closest: { entry: ProjectEntry; top: number } | undefined
  for (const candidate of entries) {
    if (candidate.id === entry.id) continue
    const candidateRegion = candidate.regions[0]
    if (!candidateRegion) continue
    if (candidateRegion.documentId !== region.documentId) continue
    if (candidateRegion.pageNumber !== region.pageNumber) continue
    const candidateTop = regionVisualTop(candidateRegion)
    if (candidateTop === undefined || candidateTop >= top) continue
    if (!closest || candidateTop > closest.top) closest = { entry: candidate, top: candidateTop }
  }
  return closest?.entry
}
