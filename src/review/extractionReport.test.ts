import assert from 'node:assert/strict'
import test from 'node:test'

import { buildExtractionReport, EXTRACTION_REPORT_CONFIDENCE_THRESHOLDS } from './extractionReport'
import type { DocumentPreflightResult, ProjectEntry } from '../shared/contracts'

function entry(id: string, overrides: Partial<ProjectEntry> = {}): ProjectEntry {
  return {
    id,
    rawText: id,
    normalizedText: id,
    source: 'parser',
    status: 'keep',
    confidence: 0.95,
    regions: [{ documentId: 'doc-1', pageNumber: 1 }],
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function preflight(overrides: Partial<DocumentPreflightResult> = {}): DocumentPreflightResult {
  return {
    documentId: 'doc-1',
    kind: 'report',
    confidence: 0.9,
    completedAt: '2026-01-01T00:00:00.000Z',
    pages: [
      { pageNumber: 1, kind: 'text', characterCount: 400, confidence: 0.9, ocrRecommended: false, rotation: 0 },
      { pageNumber: 2, kind: 'image', characterCount: 0, confidence: 0.4, ocrRecommended: true, rotation: 0 },
      { pageNumber: 3, kind: 'mixed', characterCount: 60, confidence: 0.6, ocrRecommended: false, rotation: 0 }
    ],
    ...overrides
  }
}

test('buckets pages by kind and counts OCR-recommended pages', () => {
  const report = buildExtractionReport(preflight(), [])

  assert.equal(report.pageCount, 3)
  assert.equal(report.digitalPageCount, 1)
  assert.equal(report.scannedPageCount, 1)
  assert.equal(report.mixedPageCount, 1)
  assert.equal(report.otherPageCount, 0)
  assert.equal(report.ocrPageCount, 1)
})

test('ignores entries from other documents and buckets confidence', () => {
  const report = buildExtractionReport(preflight(), [
    entry('a', { confidence: EXTRACTION_REPORT_CONFIDENCE_THRESHOLDS.low - 0.01 }),
    entry('b', { confidence: EXTRACTION_REPORT_CONFIDENCE_THRESHOLDS.high }),
    entry('c', { regions: [{ documentId: 'other-doc', pageNumber: 1 }] }),
    entry('d', { status: 'exclude', confidence: 0.6 }),
    entry('e', { status: 'maybe', confidence: 0.6 })
  ])

  assert.equal(report.confidenceDistribution.low, 1)
  assert.equal(report.confidenceDistribution.medium, 2)
  assert.equal(report.confidenceDistribution.high, 1)
  assert.equal(report.keptRowCount, 2)
  assert.equal(report.excludedRowCount, 1)
  assert.equal(report.maybeRowCount, 1)
})

test('flags attention pages from OCR recommendation, low confidence, and review issues', () => {
  const report = buildExtractionReport(
    preflight(),
    [entry('low-conf', { confidence: 0.1, regions: [{ documentId: 'doc-1', pageNumber: 3 }] })],
    {
      reviewIssues: [
        {
          id: 'duplicate:1',
          code: 'duplicate-entry',
          severity: 'warning',
          entryIds: ['a'],
          documentId: 'doc-1',
          pageNumbers: [1],
          evidence: 'repeat'
        }
      ]
    }
  )

  assert.deepEqual(report.attentionPages, [
    { pageNumber: 1, reasons: ['review-issue'] },
    { pageNumber: 2, reasons: ['ocr-recommended'] },
    { pageNumber: 3, reasons: ['low-confidence'] }
  ])
})

test('counts merged rows only from the supplied id set and reports OCR languages', () => {
  const report = buildExtractionReport(
    preflight(),
    [entry('merged-1'), entry('merged-2'), entry('plain')],
    {
      settings: { mode: 'balanced', ocrLanguages: ['eng', 'fra'] },
      mergedEntryIds: new Set(['merged-1', 'merged-2'])
    }
  )

  assert.equal(report.mergedRowCount, 2)
  assert.deepEqual(report.ocrLanguages, ['eng', 'fra'])
})
