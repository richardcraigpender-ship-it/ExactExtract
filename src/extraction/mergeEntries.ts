import type { BoundingBox, ProjectEntry, ReviewStatus, SourceRegion } from '../shared/contracts'

function canonicalText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function overlapRatio(left: BoundingBox, right: BoundingBox): number {
  if (left.coordinateSpace !== right.coordinateSpace) return 0
  const width = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x)
  )
  const height = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y)
  )
  const smallerArea = Math.min(left.width * left.height, right.width * right.height)
  return smallerArea > 0 ? (width * height) / smallerArea : 0
}

function entryOverlap(left: ProjectEntry, right: ProjectEntry): number {
  let highest = 0
  for (const leftRegion of left.regions) {
    for (const rightRegion of right.regions) {
      if (
        leftRegion.documentId !== rightRegion.documentId ||
        leftRegion.pageNumber !== rightRegion.pageNumber ||
        !leftRegion.bbox ||
        !rightRegion.bbox
      ) {
        continue
      }
      highest = Math.max(highest, overlapRatio(leftRegion.bbox, rightRegion.bbox))
    }
  }
  return highest
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
    for (const region of entry.regions) {
      regions.set(regionKey(region), {
        ...region,
        ...(region.bbox ? { bbox: { ...region.bbox } } : {})
      })
    }
  }
  return [...regions.values()]
}

function resolvedStatus(parser: ProjectEntry, ocr: ProjectEntry): ReviewStatus {
  if (parser.status !== 'maybe') return parser.status
  return ocr.status
}

function mergePair(parser: ProjectEntry, ocr: ProjectEntry): ProjectEntry {
  const preferred = ocr.confidence > parser.confidence ? ocr : parser
  const ids = [parser.id, ocr.id].sort()
  return {
    ...preferred,
    id: `merged:${ids.join('|')}`,
    source: 'merged',
    status: resolvedStatus(parser, ocr),
    confidence: Math.max(parser.confidence, ocr.confidence),
    regions: uniqueRegions([parser, ocr]),
    tags: [...new Set([...parser.tags, ...ocr.tags])].sort(),
    createdAt: parser.createdAt < ocr.createdAt ? parser.createdAt : ocr.createdAt,
    updatedAt: parser.updatedAt > ocr.updatedAt ? parser.updatedAt : ocr.updatedAt
  }
}

function compareEntries(left: ProjectEntry, right: ProjectEntry): number {
  const leftRegion = left.regions[0]
  const rightRegion = right.regions[0]
  return (
    (leftRegion?.documentId ?? '').localeCompare(rightRegion?.documentId ?? '') ||
    (leftRegion?.pageNumber ?? 0) - (rightRegion?.pageNumber ?? 0) ||
    (rightRegion?.bbox?.y ?? 0) - (leftRegion?.bbox?.y ?? 0) ||
    (leftRegion?.bbox?.x ?? 0) - (rightRegion?.bbox?.x ?? 0) ||
    left.id.localeCompare(right.id)
  )
}

export function mergeParserOcrEntries(
  parserEntries: readonly ProjectEntry[],
  ocrEntries: readonly ProjectEntry[],
  minimumOverlap = 0.5
): ProjectEntry[] {
  if (!Number.isFinite(minimumOverlap) || minimumOverlap <= 0 || minimumOverlap > 1) {
    throw new Error('minimumOverlap must be greater than 0 and at most 1.')
  }

  const unmatchedOcr = new Set(ocrEntries.map((entry) => entry.id))
  const merged = parserEntries.map((parser) => {
    const match = ocrEntries
      .filter(
        (ocr) =>
          unmatchedOcr.has(ocr.id) &&
          canonicalText(parser.normalizedText) === canonicalText(ocr.normalizedText)
      )
      .map((ocr) => ({ ocr, overlap: entryOverlap(parser, ocr) }))
      .filter((candidate) => candidate.overlap >= minimumOverlap)
      .sort(
        (left, right) =>
          right.overlap - left.overlap ||
          right.ocr.confidence - left.ocr.confidence ||
          left.ocr.id.localeCompare(right.ocr.id)
      )[0]

    if (!match) return { ...parser, regions: uniqueRegions([parser]), tags: [...parser.tags] }
    unmatchedOcr.delete(match.ocr.id)
    return mergePair(parser, match.ocr)
  })

  return [
    ...merged,
    ...ocrEntries
      .filter((entry) => unmatchedOcr.has(entry.id))
      .map((entry) => ({ ...entry, regions: uniqueRegions([entry]), tags: [...entry.tags] }))
  ].sort(compareEntries)
}
