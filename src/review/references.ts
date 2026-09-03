import type { BoundingBox, ProjectEntry } from '../shared/contracts'

const REFERENCE_PATTERN =
  /\b(?:ref(?:erence)?|card|invoice|inv|order|po|receipt|transaction|txn|id)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{2,})\b/gi
export const DEFAULT_REFERENCE_PARENT_MAX_SCORE = 160

function uniqueReferences(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const references: string[] = []
  for (const value of values) {
    const normalized = value.trim().toUpperCase()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    references.push(value.trim())
  }
  return references
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function missingReferences(references: readonly string[], existingNotes: string): string[] {
  return references.filter(
    (reference) => !new RegExp(`\\b${escapeRegExp(reference)}\\b`, 'i').test(existingNotes)
  )
}

export function extractReferencesFromText(text: string): string[] {
  return uniqueReferences([...text.matchAll(REFERENCE_PATTERN)].map((match) => match[1] ?? ''))
}

export function extractEntryReferences(
  entry: Pick<ProjectEntry, 'normalizedText' | 'rawText'>
): string[] {
  const sourceText = [entry.normalizedText, entry.rawText].filter(Boolean).join('\n')
  return extractReferencesFromText(sourceText)
}

export interface CopyKeptReferencesResult {
  entries: ProjectEntry[]
  updatedEntryCount: number
  copiedReferenceCount: number
  candidateCount?: number
  matchedCandidateCount?: number
  matchedEntryCount?: number
  unmatchedCandidateCount?: number
  noSamePageParentCount?: number
  tooFarCandidateCount?: number
  closestUnmatchedScore?: number
  alreadyPresentReferenceCount?: number
  scannedPageCount?: number
}

export interface SourceReferenceCandidate {
  documentId: string
  pageNumber: number
  text: string
  bbox: BoundingBox
  confidence?: number
  source?: 'pdf-text-reference-scan' | 'ocr-reference-scan'
  references?: readonly string[]
}

export interface SourceReferenceCopyOptions {
  scannedPageCount?: number
  maxParentScore?: number
}

export function copyKeptEntryReferencesToNotes(
  entries: readonly ProjectEntry[],
  updatedAt: string
): CopyKeptReferencesResult {
  let updatedEntryCount = 0
  let copiedReferenceCount = 0
  const nextEntries = entries.map((entry) => {
    if (entry.status !== 'keep') return entry
    const references = extractEntryReferences(entry)
    if (references.length === 0) return entry
    const existingNotes = entry.notes?.trim() ?? ''
    const missing = missingReferences(references, existingNotes)
    if (missing.length === 0) return entry
    updatedEntryCount += 1
    copiedReferenceCount += missing.length
    return {
      ...entry,
      notes: existingNotes ? `${existingNotes}\n${missing.join(', ')}` : missing.join(', '),
      updatedAt
    }
  })

  return { entries: nextEntries, updatedEntryCount, copiedReferenceCount }
}

function centerY(bbox: BoundingBox): number {
  return bbox.y + bbox.height / 2
}

function xOverlap(left: BoundingBox, right: BoundingBox): number {
  return Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x)
  )
}

function referenceValues(candidate: SourceReferenceCandidate): string[] {
  return uniqueReferences(candidate.references ?? extractReferencesFromText(candidate.text))
}

function bestParentEntry(
  reference: SourceReferenceCandidate,
  entries: readonly ProjectEntry[]
): { entry?: ProjectEntry; score?: number; hasSamePageParent: boolean } {
  const eligibleEntries = entries.filter((entry) =>
    entry.regions.some(
      (region) =>
        region.documentId === reference.documentId &&
        region.pageNumber === reference.pageNumber &&
        region.bbox?.coordinateSpace === 'pdf-points'
    )
  )
  if (eligibleEntries.length === 0) return { hasSamePageParent: false }
  const best = eligibleEntries
    .map((entry) => {
      const region = entry.regions.find(
        (candidate) =>
          candidate.documentId === reference.documentId &&
          candidate.pageNumber === reference.pageNumber &&
          candidate.bbox?.coordinateSpace === 'pdf-points'
      )
      const bbox = region?.bbox
      if (!bbox) return { entry, score: Number.POSITIVE_INFINITY }
      const verticalDistance = Math.abs(centerY(bbox) - centerY(reference.bbox))
      const horizontalPenalty =
        xOverlap(bbox, reference.bbox) > 0 ? 0 : Math.abs(bbox.x - reference.bbox.x)
      return { entry, score: verticalDistance + horizontalPenalty * 0.25 }
    })
    .sort((left, right) => left.score - right.score)[0]
  return { entry: best?.entry, score: best?.score, hasSamePageParent: true }
}

export function copySourceReferencesToKeptEntryNotes(
  entries: readonly ProjectEntry[],
  references: readonly SourceReferenceCandidate[],
  updatedAt: string,
  options: SourceReferenceCopyOptions = {}
): CopyKeptReferencesResult {
  const keptEntries = entries.filter((entry) => entry.status === 'keep')
  const additions = new Map<string, string[]>()
  let unmatchedCandidateCount = 0
  let noSamePageParentCount = 0
  let tooFarCandidateCount = 0
  let closestUnmatchedScore: number | undefined
  let matchedCandidateCount = 0
  const maxParentScore = Math.max(1, options.maxParentScore ?? DEFAULT_REFERENCE_PARENT_MAX_SCORE)
  for (const candidate of references) {
    const values = referenceValues(candidate)
    if (values.length === 0) continue
    const parentMatch = bestParentEntry(candidate, keptEntries)
    if (
      !parentMatch.entry ||
      parentMatch.score === undefined ||
      parentMatch.score > maxParentScore
    ) {
      unmatchedCandidateCount += 1
      if (!parentMatch.hasSamePageParent) noSamePageParentCount += 1
      else {
        tooFarCandidateCount += 1
        closestUnmatchedScore = Math.min(
          closestUnmatchedScore ?? Number.POSITIVE_INFINITY,
          parentMatch.score ?? Number.POSITIVE_INFINITY
        )
      }
      continue
    }
    matchedCandidateCount += 1
    const current = additions.get(parentMatch.entry.id) ?? []
    additions.set(parentMatch.entry.id, uniqueReferences([...current, ...values]))
  }

  let updatedEntryCount = 0
  let copiedReferenceCount = 0
  let alreadyPresentReferenceCount = 0
  const nextEntries = entries.map((entry) => {
    const referencesForEntry = additions.get(entry.id) ?? []
    if (entry.status !== 'keep' || referencesForEntry.length === 0) return entry
    const existingNotes = entry.notes?.trim() ?? ''
    const missing = missingReferences(referencesForEntry, existingNotes)
    alreadyPresentReferenceCount += referencesForEntry.length - missing.length
    if (missing.length === 0) return entry
    updatedEntryCount += 1
    copiedReferenceCount += missing.length
    return {
      ...entry,
      notes: existingNotes ? `${existingNotes}\n${missing.join(', ')}` : missing.join(', '),
      updatedAt
    }
  })

  return {
    entries: nextEntries,
    updatedEntryCount,
    copiedReferenceCount,
    candidateCount: references.length,
    matchedCandidateCount,
    matchedEntryCount: additions.size,
    unmatchedCandidateCount,
    noSamePageParentCount,
    tooFarCandidateCount,
    ...(closestUnmatchedScore === undefined ? {} : { closestUnmatchedScore }),
    alreadyPresentReferenceCount,
    scannedPageCount: options.scannedPageCount
  }
}
