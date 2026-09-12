import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ProjectEntry } from '../../../shared/contracts'
import { deriveAnalysisState, DEFAULT_ANALYSIS_CONFIGURATION } from '../analysisPersistence'
import { AnalysisWorkspace } from './AnalysisWorkspace'

void React

function entry(
  id: string,
  status: ProjectEntry['status'],
  text: string,
  payee?: string
): ProjectEntry {
  return {
    id,
    rawText: text,
    normalizedText: text,
    source: 'parser',
    status,
    confidence: 0.95,
    regions: [{ documentId: 'document-1', pageNumber: 1 }],
    tags: [],
    payee,
    createdAt: '2026-03-12T00:00:00.000Z',
    updatedAt: '2026-03-12T00:00:00.000Z'
  }
}

test('shows mapped payee evidence and keeps all-versus-kept dataset controls visible', () => {
  const entries = [
    entry('vendor-a', 'keep', '2026-03-12 Acme Supplies 10.00 0.00 90.00', 'Acme Supplies'),
    entry('vendor-b', 'keep', '2026-03-13 Acme Supplies 5.00 0.00 85.00', 'Acme Supplies'),
    entry('excluded', 'exclude', '2026-03-14 Other Vendor 20.00 0.00 65.00', 'Other Vendor')
  ]
  const state = deriveAnalysisState(entries, DEFAULT_ANALYSIS_CONFIGURATION)
  const markup = renderToStaticMarkup(
    <AnalysisWorkspace
      entries={entries}
      configuration={DEFAULT_ANALYSIS_CONFIGURATION}
      snapshot={state.snapshot}
      onNavigateToEntry={() => undefined}
      onConfigurationChange={() => undefined}
    />
  )

  assert.match(markup, /All extracted/)
  assert.match(markup, /Kept entries/)
  assert.match(markup, /Mapped business descriptions/)
  assert.match(markup, /Acme Supplies/)
  assert.match(markup, /Occurrences/)
  assert.match(markup, /Balance snapshot sum is the sum of balance snapshots/)
  assert.equal(markup.match(/All monetary values in this section are in GBP\./g)?.length, 2)
  assert.match(markup, /role="tabpanel" aria-labelledby="statement-dataset-tab-all"/)
  assert.match(markup, /aria-label="Open source entry vendor-a"/)
})

test('formats monetary values with the project currency', () => {
  const entries = [
    entry('vendor-a', 'keep', '2026-03-12 Acme Supplies 10.00 0.00 90.00', 'Acme Supplies')
  ]
  const state = deriveAnalysisState(entries, DEFAULT_ANALYSIS_CONFIGURATION)
  const markup = renderToStaticMarkup(
    <AnalysisWorkspace
      entries={entries}
      configuration={DEFAULT_ANALYSIS_CONFIGURATION}
      snapshot={state.snapshot}
      currencyCode="USD"
      onNavigateToEntry={() => undefined}
      onConfigurationChange={() => undefined}
    />
  )

  assert.match(markup, /All monetary values in this section are in USD\./)
  assert.match(markup, /\$10\.00/)
})
