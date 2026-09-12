import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExtractionReportPanel, type ExtractionReportDocumentSummary } from './ExtractionReportPanel'
import type { ExtractionDocumentReport } from '../../../review'

void React

const noop = (): void => {}

function report(overrides: Partial<ExtractionDocumentReport> = {}): ExtractionDocumentReport {
  return {
    documentId: 'doc-1',
    pageCount: 3,
    digitalPageCount: 1,
    scannedPageCount: 1,
    mixedPageCount: 1,
    otherPageCount: 0,
    ocrPageCount: 1,
    ocrLanguages: ['eng'],
    confidenceDistribution: { low: 1, medium: 1, high: 1 },
    keptRowCount: 2,
    maybeRowCount: 1,
    excludedRowCount: 1,
    mergedRowCount: 0,
    attentionPages: [{ pageNumber: 2, reasons: ['ocr-recommended'] }],
    ...overrides
  }
}

function summary(overrides: Partial<ExtractionReportDocumentSummary> = {}): ExtractionReportDocumentSummary {
  return {
    documentId: 'doc-1',
    documentName: 'statement.pdf',
    report: report(),
    ...overrides
  }
}

test('reports an honest empty state before extraction has run', () => {
  const markup = renderToStaticMarkup(
    <ExtractionReportPanel summaries={[]} onNavigateToPage={noop} onFilterByReason={noop} />
  )

  assert.match(markup, /Run extraction to see a per-document quality summary/)
})

test('renders per-document counts, OCR languages, and attention pages', () => {
  const markup = renderToStaticMarkup(
    <ExtractionReportPanel summaries={[summary()]} onNavigateToPage={noop} onFilterByReason={noop} />
  )

  assert.match(markup, /statement\.pdf/)
  assert.match(markup, /3 pages/)
  assert.match(markup, /OCR languages: eng/)
  assert.match(markup, /1 excluded/)
  assert.match(markup, /1 maybe/)
  assert.match(markup, /p2/)
})

test('omits the attention list when nothing needs attention', () => {
  const markup = renderToStaticMarkup(
    <ExtractionReportPanel
      summaries={[summary({ report: report({ attentionPages: [] }) })]}
      onNavigateToPage={noop}
      onFilterByReason={noop}
    />
  )

  assert.doesNotMatch(markup, /Needs attention/)
})
