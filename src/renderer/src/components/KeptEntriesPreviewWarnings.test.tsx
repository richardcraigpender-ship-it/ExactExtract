import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ProjectEntry } from '../../../shared/contracts'
import type { KeptEntriesCanvasLayout } from '../../../shared/keptEntriesLayout'
import { KeptEntriesPreviewWarnings } from './KeptEntriesPreviewWarnings'

void React

const entry: ProjectEntry = {
  id: 'entry-1',
  rawText: 'Vendor',
  normalizedText: 'Vendor',
  status: 'keep',
  source: 'parser',
  confidence: 0.9,
  regions: [],
  tags: [],
  createdAt: '2026-08-22T00:00:00.000Z',
  updatedAt: '2026-08-22T00:00:00.000Z'
}

const layout: KeptEntriesCanvasLayout = {
  version: 1,
  pageSize: 'letter',
  orientation: 'portrait',
  placements: [
    {
      id: 'placement-1',
      entryId: entry.id,
      text: 'Vendor',
      x: 600,
      y: 48,
      width: 200,
      height: 28,
      rotation: 0,
      fontRef: { kind: 'system', family: 'Aptos' },
      fontSize: 11,
      color: '#000000'
    }
  ]
}

test('shows shared preview warnings for invalid bounds and system-font fallback', () => {
  const markup = renderToStaticMarkup(
    <KeptEntriesPreviewWarnings entries={[entry]} layout={layout} />
  )

  assert.match(markup, /Review before export/)
  assert.match(markup, /extends beyond the page bounds/)
  assert.match(markup, /Aptos/)
})
