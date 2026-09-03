import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ReferenceToolsPanel } from './ReferenceToolsPanel'

void React

function render(overrides: Partial<React.ComponentProps<typeof ReferenceToolsPanel>> = {}): string {
  return renderToStaticMarkup(
    <ReferenceToolsPanel
      hasKeptEntries
      hasActiveDocument
      isScanning={false}
      ocrLanguages={['eng']}
      onCopyExisting={() => undefined}
      onScanPdfText={() => undefined}
      onScanOcr={() => undefined}
      onCancelScan={() => undefined}
      onToggleOcrLanguage={() => undefined}
      {...overrides}
    />
  )
}

function buttonTag(markup: string, label: string): string {
  const index = markup.indexOf(label)
  assert.ok(index >= 0, `expected ${label}`)
  const start = markup.lastIndexOf('<button', index)
  return markup.slice(start, markup.indexOf('>', start) + 1)
}

test('renders all three reference recovery actions and status output', () => {
  const markup = render({ status: 'Scanned and copied 2 source references.' })

  assert.match(markup, /aria-label="Reference tools"/)
  assert.match(markup, /1\. Copy entry refs/)
  assert.match(markup, /2\. Scan PDF text refs/)
  assert.match(markup, /3\. OCR scan source refs/)
  assert.match(markup, /OCR languages for source re-scan/)
  assert.match(markup, /English/)
  assert.match(markup, /Spanish/)
  assert.match(markup, /role="status"/)
})

test('requires a selected OCR language before the OCR reference scan can start', () => {
  const markup = render({ ocrLanguages: [] })

  assert.match(buttonTag(markup, '3. OCR scan source refs'), /disabled=""/)
  assert.match(markup, /Select at least one language before starting an OCR re-scan/)
})

test('disables all actions when there are no kept entries', () => {
  const markup = render({ hasKeptEntries: false })

  assert.match(buttonTag(markup, '1. Copy entry refs'), /disabled=""/)
  assert.match(buttonTag(markup, '2. Scan PDF text refs'), /disabled=""/)
  assert.match(buttonTag(markup, '3. OCR scan source refs'), /disabled=""/)
})

test('disables all reference actions while extraction or export is active', () => {
  const markup = render({ isBusy: true })

  assert.match(buttonTag(markup, '1. Copy entry refs'), /disabled=""/)
  assert.match(buttonTag(markup, '2. Scan PDF text refs'), /disabled=""/)
  assert.match(buttonTag(markup, '3. OCR scan source refs'), /disabled=""/)
})

test('shows scan results and disables duplicate scanning', () => {
  const markup = render({
    isScanning: true,
    results: {
      existing: {
        action: 'existing',
        candidateCount: 1,
        matchedEntryCount: 1,
        copiedReferenceCount: 1
      },
      ocr: {
        action: 'ocr',
        scannedPageCount: 2,
        candidateCount: 5,
        matchedEntryCount: 3,
        copiedReferenceCount: 4,
        unmatchedCandidateCount: 2
      }
    }
  })

  assert.match(markup, /<table/)
  assert.match(markup, /<th scope="col">Existing entries<\/th>/)
  assert.match(markup, /<th scope="col">OCR source scan<\/th>/)
  assert.match(markup, /<th scope="row">Found<\/th>/)
  assert.match(markup, /<th scope="row">Added<\/th>/)
  assert.match(markup, />5</)
  assert.match(buttonTag(markup, '2. Scan PDF text refs'), /disabled=""/)
  assert.match(buttonTag(markup, 'OCR scanning'), /disabled=""/)
  assert.match(markup, / Cancel</)
})
