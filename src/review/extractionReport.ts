import type { DocumentPreflightResult, ExtractionSettings, ProjectEntry } from '../shared/contracts'
import type { ReviewIssue } from './heuristics'

/** Confidence buckets for the report's distribution; distinct from the queue's single cutoff. */
export const EXTRACTION_REPORT_CONFIDENCE_THRESHOLDS = { low: 0.5, high: 0.85 } as const

export interface ExtractionConfidenceDistribution {
  low: number
  medium: number
  high: number
}

export type ExtractionReportAttentionReason = 'ocr-recommended' | 'low-confidence' | 'review-issue'

export interface ExtractionReportAttentionPage {
  pageNumber: number
  reasons: ExtractionReportAttentionReason[]
}

export interface ExtractionDocumentReport {
  documentId: string
  pageCount: number
  digitalPageCount: number
  scannedPageCount: number
  mixedPageCount: number
  /** Sparse, rotated, or unclassified pages; kept separate so the buckets above sum to pageCount. */
  otherPageCount: number
  ocrPageCount: number
  ocrLanguages: string[]
  confidenceDistribution: ExtractionConfidenceDistribution
  keptRowCount: number
  maybeRowCount: number
  excludedRowCount: number
  mergedRowCount: number
  attentionPages: ExtractionReportAttentionPage[]
}

export interface ExtractionReportOptions {
  settings?: ExtractionSettings
  reviewIssues?: readonly ReviewIssue[]
  /** Callers own audit-trail parsing; this contract only counts the IDs it is given. */
  mergedEntryIds?: ReadonlySet<string>
}

function confidenceBucket(confidence: number): keyof ExtractionConfidenceDistribution {
  if (confidence < EXTRACTION_REPORT_CONFIDENCE_THRESHOLDS.low) return 'low'
  if (confidence < EXTRACTION_REPORT_CONFIDENCE_THRESHOLDS.high) return 'medium'
  return 'high'
}

/**
 * Builds a per-document extraction summary from already-persisted contracts (preflight, entries,
 * settings, review issues) so the report stays correct in the live session, not only after reload.
 */
export function buildExtractionReport(
  preflight: DocumentPreflightResult,
  entries: readonly ProjectEntry[],
  options: ExtractionReportOptions = {}
): ExtractionDocumentReport {
  const documentEntries = entries.filter((entry) =>
    entry.regions.some((region) => region.documentId === preflight.documentId)
  )

  const confidenceDistribution: ExtractionConfidenceDistribution = { low: 0, medium: 0, high: 0 }
  let keptRowCount = 0
  let maybeRowCount = 0
  let excludedRowCount = 0
  let mergedRowCount = 0
  for (const entry of documentEntries) {
    confidenceDistribution[confidenceBucket(entry.confidence)] += 1
    if (entry.status === 'keep') keptRowCount += 1
    else if (entry.status === 'maybe') maybeRowCount += 1
    else excludedRowCount += 1
    if (options.mergedEntryIds?.has(entry.id)) mergedRowCount += 1
  }

  let digitalPageCount = 0
  let scannedPageCount = 0
  let mixedPageCount = 0
  let otherPageCount = 0
  for (const page of preflight.pages) {
    if (page.kind === 'text') digitalPageCount += 1
    else if (page.kind === 'image') scannedPageCount += 1
    else if (page.kind === 'mixed') mixedPageCount += 1
    else otherPageCount += 1
  }
  const ocrPageCount = preflight.pages.filter((page) => page.ocrRecommended).length

  const issuesByPage = new Map<number, ReviewIssue[]>()
  for (const issue of options.reviewIssues ?? []) {
    if (issue.documentId !== preflight.documentId) continue
    for (const pageNumber of issue.pageNumbers) {
      issuesByPage.set(pageNumber, [...(issuesByPage.get(pageNumber) ?? []), issue])
    }
  }
  const lowConfidencePages = new Set(
    documentEntries
      .filter((entry) => entry.confidence < EXTRACTION_REPORT_CONFIDENCE_THRESHOLDS.low)
      .flatMap((entry) =>
        entry.regions
          .filter((region) => region.documentId === preflight.documentId)
          .map((region) => region.pageNumber)
      )
  )

  const attentionPages: ExtractionReportAttentionPage[] = []
  for (const page of preflight.pages) {
    const reasons: ExtractionReportAttentionReason[] = []
    if (page.ocrRecommended) reasons.push('ocr-recommended')
    if (lowConfidencePages.has(page.pageNumber)) reasons.push('low-confidence')
    if (issuesByPage.has(page.pageNumber)) reasons.push('review-issue')
    if (reasons.length > 0) attentionPages.push({ pageNumber: page.pageNumber, reasons })
  }
  attentionPages.sort((left, right) => left.pageNumber - right.pageNumber)

  return {
    documentId: preflight.documentId,
    pageCount: preflight.pages.length,
    digitalPageCount,
    scannedPageCount,
    mixedPageCount,
    otherPageCount,
    ocrPageCount,
    ocrLanguages: [...(options.settings?.ocrLanguages ?? [])],
    confidenceDistribution,
    keptRowCount,
    maybeRowCount,
    excludedRowCount,
    mergedRowCount,
    attentionPages
  }
}
