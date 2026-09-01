import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ProjectEntry } from '../../../shared/contracts'
import type { KeptEntryPlacement } from '../../../shared/keptEntriesLayout'
import { reorderEntryIds } from '../lib/reorderEntryIds'
import { ExportEntriesPanel } from './ExportEntriesPanel'

void React

function entry(id: string, status: ProjectEntry['status'], text: string): ProjectEntry {
  return {
    id,
    rawText: text,
    normalizedText: text,
    source: 'parser',
    status,
    confidence: 0.9,
    regions: [{ documentId: 'document-1', pageNumber: 1 }],
    tags: [],
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z'
  }
}

function placement(entryId: string): KeptEntryPlacement {
  return {
    id: `placement-${entryId}`,
    entryId,
    text: 'placed text',
    x: 48,
    y: 48,
    width: 200,
    height: 28,
    rotation: 0,
    fontRef: { kind: 'standard-14', family: 'Helvetica' },
    fontSize: 11,
    color: '#17231c'
  }
}

test('lists only kept entries and marks which ones are already placed on canvas', () => {
  const markup = renderToStaticMarkup(
    <ExportEntriesPanel
      entries={[
        entry('a', 'keep', 'Alpha row'),
        entry('b', 'keep', 'Beta row'),
        entry('c', 'exclude', 'Excluded row')
      ]}
      placements={[placement('a')]}
    />
  )

  assert.match(markup, />2 entries</)
  assert.match(markup, /Alpha row/)
  assert.match(markup, /Beta row/)
  assert.doesNotMatch(markup, /Excluded row/)
  assert.match(markup, />On canvas</)
  assert.match(markup, />Not placed</)
})

test('shows an empty state when there are no kept entries', () => {
  const markup = renderToStaticMarkup(
    <ExportEntriesPanel entries={[entry('a', 'exclude', 'Excluded row')]} placements={[]} />
  )

  assert.match(markup, /No kept entries to place yet\./)
})

test('renders editable and draggable controls when interaction callbacks are provided', () => {
  const markup = renderToStaticMarkup(
    <ExportEntriesPanel
      entries={[entry('a', 'keep', 'Alpha row')]}
      placements={[]}
      onEntryTextChange={() => undefined}
      onReorder={() => undefined}
    />
  )

  assert.match(markup, /class="export-entry-item\s*" draggable="true"/)
  assert.match(markup, /aria-label="Edit kept entry a"/)
  assert.match(markup, /value="Alpha row"/)
})

test('allows canvas dragging without enabling list reordering', () => {
  const markup = renderToStaticMarkup(
    <ExportEntriesPanel
      entries={[entry('a', 'keep', 'Alpha row')]}
      placements={[]}
      allowCanvasDrag
    />
  )

  assert.match(markup, /class="export-entry-item\s*" draggable="true"/)
})

test('exposes kept text entries as canvas placement actions when supported', () => {
  const markup = renderToStaticMarkup(
    <ExportEntriesPanel
      entries={[entry('a', 'keep', 'Alpha row')]}
      placements={[]}
      allowCanvasDrag
      onPlaceEntry={() => undefined}
    />
  )

  assert.match(markup, /role="button"/)
  assert.match(markup, /tabIndex="0"|tabindex="0"/)
  assert.match(markup, /aria-label="Place kept entry a on canvas"/)
})

test('reorders an entry before its drop target and preserves unknown ids', () => {
  assert.deepEqual(reorderEntryIds(['a', 'b', 'c'], 'a', 'c'), ['b', 'a', 'c'])
  assert.deepEqual(reorderEntryIds(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b'])
  assert.deepEqual(reorderEntryIds(['a', 'b'], 'missing', 'a'), ['a', 'b'])
})
