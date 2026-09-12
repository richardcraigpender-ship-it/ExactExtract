import type { ProjectEntry } from '../shared/contracts'
import type { ReviewIssue } from './heuristics'

export const DEFAULT_REVIEW_QUEUE_CONFIDENCE_THRESHOLD = 0.7

export type ReviewQueueReasonCode =
  | 'low-confidence'
  | 'ocr-derived'
  | 'maybe-status'
  | 'duplicate-candidate'
  | 'review-warning'
  | 'unmapped-financial-row'

export interface ReviewQueueReason {
  code: ReviewQueueReasonCode
  label: string
  priority: number
}

export interface ReviewQueueItem {
  entryId: string
  reasons: ReviewQueueReason[]
  priority: number
}

export interface ReviewQueueOptions {
  confidenceThreshold?: number
  reviewIssues?: readonly ReviewIssue[]
  analysisIssueEntryIds?: ReadonlySet<string>
  unmappedEntryIds?: ReadonlySet<string>
}

const REASONS: Record<ReviewQueueReasonCode, Omit<ReviewQueueReason, 'code'>> = {
  'low-confidence': { label: 'Low confidence', priority: 10 },
  'ocr-derived': { label: 'OCR-derived', priority: 20 },
  'maybe-status': { label: 'Maybe status', priority: 30 },
  'duplicate-candidate': { label: 'Possible duplicate', priority: 40 },
  'review-warning': { label: 'Review warning', priority: 50 },
  'unmapped-financial-row': { label: 'Unmapped financial row', priority: 60 }
}

function reason(code: ReviewQueueReasonCode): ReviewQueueReason {
  return { code, ...REASONS[code] }
}

export function buildReviewQueue(
  entries: readonly ProjectEntry[],
  options: ReviewQueueOptions = {}
): ReviewQueueItem[] {
  const threshold = Math.max(
    0,
    Math.min(1, options.confidenceThreshold ?? DEFAULT_REVIEW_QUEUE_CONFIDENCE_THRESHOLD)
  )
  const reasonsByEntry = new Map<string, Set<ReviewQueueReasonCode>>()
  const addReason = (entryId: string, code: ReviewQueueReasonCode): void => {
    const codes = reasonsByEntry.get(entryId) ?? new Set<ReviewQueueReasonCode>()
    codes.add(code)
    reasonsByEntry.set(entryId, codes)
  }

  const duplicateEntryIds = new Set(
    (options.reviewIssues ?? [])
      .filter((issue) => issue.code === 'duplicate-entry')
      .flatMap((issue) => issue.entryIds)
  )
  const warningEntryIds = new Set(
    (options.reviewIssues ?? [])
      .filter((issue) => issue.code !== 'duplicate-entry')
      .flatMap((issue) => issue.entryIds)
  )

  for (const entry of entries) {
    if (entry.confidence < threshold) addReason(entry.id, 'low-confidence')
    if (entry.source === 'ocr') addReason(entry.id, 'ocr-derived')
    if (entry.status === 'maybe') addReason(entry.id, 'maybe-status')
    if (duplicateEntryIds.has(entry.id)) addReason(entry.id, 'duplicate-candidate')
    if (warningEntryIds.has(entry.id) || options.analysisIssueEntryIds?.has(entry.id)) {
      addReason(entry.id, 'review-warning')
    }
    if (options.unmappedEntryIds?.has(entry.id)) addReason(entry.id, 'unmapped-financial-row')
  }

  return [...reasonsByEntry.entries()]
    .map(([entryId, codes]) => {
      const reasons = [...codes]
        .map(reason)
        .sort((left, right) => left.priority - right.priority || left.code.localeCompare(right.code))
      return {
        entryId,
        reasons,
        priority: reasons[0]?.priority ?? Number.POSITIVE_INFINITY
      }
    })
    .sort((left, right) => left.priority - right.priority || left.entryId.localeCompare(right.entryId))
}
