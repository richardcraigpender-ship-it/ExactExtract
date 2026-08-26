import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ProjectEntry } from '../../../shared/contracts'
import { SourceMetadataPanel } from './SourceMetadataPanel'

void React

const entry: ProjectEntry = {
  id: 'entry-1',
  rawText: 'Total',
  normalizedText: 'Total',
  source: 'parser',
  status: 'keep',
  confidence: 0.9,
  regions: [{ documentId: 'document-1', pageNumber: 2 }],
  tags: [],
  createdAt: '2026-08-22T00:00:00.000Z',
  updatedAt: '2026-08-22T00:00:00.000Z'
}

test('summarizes source traceability without exposing entry text', () => {
  const markup = renderToStaticMarkup(
    <SourceMetadataPanel
      entries={[entry]}
      placements={[
        {
          id: 'placement-1',
          entryId: entry.id,
          text: entry.normalizedText,
          x: 48,
          y: 48,
          width: 200,
          height: 28,
          rotation: 0,
          fontRef: { kind: 'system', family: 'Aptos' },
          fontSize: 11,
          color: '#17231c'
        }
      ]}
    />
  )

  assert.match(markup, /Original source metadata/)
  assert.match(markup, />1</)
  assert.match(markup, /Aptos/)
  assert.doesNotMatch(markup, />Total</)
})
