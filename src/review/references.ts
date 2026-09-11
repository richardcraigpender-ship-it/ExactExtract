import type { BoundingBox, ProjectEntry } from '../shared/contracts'

const REFERENCE_MARKER = '(?:ref(?:erence)?|card|invoice|inv|order|po|receipt|transaction|txn|id)'
// The marker must be a whole word followed by a real separator, otherwise ordinary
// words match by prefix ("POINTS" -> po + INTS, "Cardholder" -> card + holder).
const REFERENCE_PATTERN = new RegExp(
  `\\b${REFERENCE_MARKER}(?:\\s*[:#-]\\s*|\\s+)([A-Za-z0-9][A-Za-z0-9/-]{2,})\\b`,
  'gi'
)
const CONTAINS_DIGIT = /\d/
export const DEFAULT_REFERENCE_PARENT_MAX_SCORE = 48

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
  return uniqueReferences(
    [...text.matchAll(REFERENCE_PATTERN)]
      .map((match) => match[1] ?? '')
      // Real references carry a digit; this drops names like "Order Smith".
      .filter((value) => CONTAINS_DIGIT.test(value))
  )
}

export function extractEntryReferences(
  entry: Pick<ProjectEntry, 'normalizedText' | 'rawText'>
): string[] {
  const sourceText = [entry.normalizedText, entry.rawText].filter(Boolean).join('\n')
  return extractReferencesFromText(sourceText)
}

const REFERENCE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9/-]{2,}$/

/** The scans append references as their own comma-separated line, so prose notes survive. */
function referenceOnlyLine(line: string): boolean {
  const parts = line
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return false
  return parts.every((part) => REFERENCE_TOKEN.test(part) && CONTAINS_DIGIT.test(part))
}

export interface ClearReferenceNotesResult {
  entries: ProjectEntry[]
  updatedEntryCount: number
  removedReferenceCount: number
}

export function clearScannedReferenceNotes(
  entries: readonly ProjectEntry[],
  updatedAt: string
): ClearReferenceNotesResult {
  let updatedEntryCount = 0
  let removedReferenceCount = 0
  const nextEntries = entries.map((entry) => {
    const captured = entry.reference?.trim()
    // Verbatim blocks are not token-shaped, so they are matched against the captured text itself.
    const capturedLines = new Set(
      (captured?.split('\n') ?? []).map((line) => line.trim()).filter(Boolean)
    )
    const notes = entry.notes
    const lines = notes ? notes.split('\n') : []
    const kept: string[] = []
    let removed = 0
    for (const line of lines) {
      if (referenceOnlyLine(line)) {
        removed += line.split(',').filter((part) => part.trim()).length
        continue
      }
      if (capturedLines.has(line.trim())) {
        removed += 1
        continue
      }
      kept.push(line)
    }
    if (captured) removed += capturedLines.size
    if (removed === 0) return entry
    updatedEntryCount += 1
    removedReferenceCount += removed
    const nextNotes = kept.join('\n').trim()
    const next: ProjectEntry = { ...entry, updatedAt }
    if (nextNotes) next.notes = nextNotes
    else delete next.notes
    delete next.reference
    return next
  })

  return { entries: nextEntries, updatedEntryCount, removedReferenceCount }
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
  /** Verbatim block text; when present it is copied instead of a parsed reference token. */
  detailText?: string
}

export interface SourceReferenceCopyOptions {
  scannedPageCount?: number
  maxParentScore?: number
}

/**
 * Copies the verbatim reference captured at extraction into the notes field. Parsed tokens are
 * never synthesised here, so an entry without captured reference text is left untouched.
 */
export function copyKeptEntryReferencesToNotes(
  entries: readonly ProjectEntry[],
  updatedAt: string
): CopyKeptReferencesResult {
  let updatedEntryCount = 0
  let copiedReferenceCount = 0
  const nextEntries = entries.map((entry) => {
    if (entry.status !== 'keep') return entry
    const reference = entry.reference?.trim()
    if (!reference) return entry
    const existingNotes = entry.notes?.trim() ?? ''
    if (existingNotes.includes(reference)) return entry
    updatedEntryCount += 1
    copiedReferenceCount += 1
    return {
      ...entry,
      notes: existingNotes ? `${existingNotes}\n${reference}` : reference,
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

function yOverlap(left: BoundingBox, right: BoundingBox): number {
  return Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y)
  )
}

/**
 * A verbatim block that sits on the parent row is that row, not a detail line beneath it.
 * Works regardless of whether page coordinates run top-down or bottom-up.
 */
function overlapsParentRow(candidate: SourceReferenceCandidate, entry: ProjectEntry): boolean {
  const region = entry.regions.find(
    (region) =>
      region.documentId === candidate.documentId &&
      region.pageNumber === candidate.pageNumber &&
      region.bbox?.coordinateSpace === 'pdf-points'
  )
  const bbox = region?.bbox
  if (!bbox) return false
  return yOverlap(bbox, candidate.bbox) > Math.min(bbox.height, candidate.bbox.height) * 0.5
}

function referenceValues(candidate: SourceReferenceCandidate): string[] {
  const detail = candidate.detailText?.trim()
  if (detail) return [detail]
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
      return { entry, score: verticalDistance + horizontalPenalty }
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
    if (candidate.detailText && overlapsParentRow(candidate, parentMatch.entry)) {
      unmatchedCandidateCount += 1
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
    const captured = missing.join('\n')
    const existingReference = entry.reference?.trim() ?? ''
    return {
      ...entry,
      notes: existingNotes ? `${existingNotes}\n${missing.join(', ')}` : missing.join(', '),
      reference: existingReference ? `${existingReference}\n${captured}` : captured,
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
