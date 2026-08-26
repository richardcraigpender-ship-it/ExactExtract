import type { DocumentPreflightResult } from '../shared/contracts'
import { detectDocumentKind } from './documentKind'
import type { ClassifiedPage } from './types'

export function buildDocumentPreflight(
  documentId: string,
  pages: readonly ClassifiedPage[],
  completedAt: string = new Date().toISOString()
): DocumentPreflightResult {
  if (documentId.trim().length === 0) throw new Error('documentId is required.')
  if (Number.isNaN(Date.parse(completedAt))) throw new Error('completedAt must be an ISO date.')

  const pageNumbers = new Set<number>()
  for (const page of pages) {
    if (page.documentId !== documentId) throw new Error('All pages must belong to documentId.')
    if (pageNumbers.has(page.pageNumber))
      throw new Error(`Duplicate page number: ${page.pageNumber}`)
    pageNumbers.add(page.pageNumber)
  }

  const orderedPages = [...pages].sort((left, right) => left.pageNumber - right.pageNumber)
  const classification = detectDocumentKind(orderedPages)

  return {
    documentId,
    kind: classification.kind,
    confidence: classification.confidence,
    pages: orderedPages.map((page) => ({
      pageNumber: page.pageNumber,
      kind: page.kind,
      characterCount: page.characterCount,
      confidence: page.classificationConfidence,
      ocrRecommended: page.ocrRecommended,
      rotation: page.rotation
    })),
    completedAt
  }
}
