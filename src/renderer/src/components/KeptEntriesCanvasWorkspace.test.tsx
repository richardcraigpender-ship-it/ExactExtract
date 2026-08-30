import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { ProjectEntry } from '../../../shared/contracts'
import type { KeptEntriesCanvasLayout } from '../../../shared/keptEntriesLayout'
import { KeptEntriesCanvasWorkspace } from './KeptEntriesCanvasWorkspace'

void React

const entries: ProjectEntry[] = [
  {
    id: 'entry-1',
    documentId: 'document-1',
    normalizedText: 'Invoice total 120.00',
    rawText: 'Invoice total 120.00',
    status: 'keep',
    source: 'parser',
    confidence: 0.9,
    tags: [],
    regions: [{ documentId: 'document-1', pageNumber: 1 }],
    createdAt: '2026-08-29T10:00:00.000Z',
    updatedAt: '2026-08-29T10:00:00.000Z'
  } as unknown as ProjectEntry
]

const layout: KeptEntriesCanvasLayout = {
  version: 2,
  pageSize: 'letter',
  orientation: 'portrait',
  pageCount: 2,
  placements: [],
  images: [
    {
      id: 'kept-image-1',
      source: { kind: 'uploaded-png', ref: 'receipt.png' },
      pageNumber: 1,
      x: 48,
      y: 48,
      width: 240,
      height: 120,
      fit: 'contain'
    },
    {
      id: 'kept-image-2',
      source: { kind: 'session-entry', ref: 'entry-1' },
      entryId: 'entry-1',
      pageNumber: 2,
      x: 48,
      y: 48,
      width: 240,
      height: 120,
      fit: 'contain'
    }
  ]
}

function renderWorkspace(
  overrides: Partial<React.ComponentProps<typeof KeptEntriesCanvasWorkspace>> = {}
): string {
  return renderToStaticMarkup(
    <KeptEntriesCanvasWorkspace
      entries={entries}
      layout={layout}
      onLayoutChange={() => {}}
      onClose={() => {}}
      onExport={() => {}}
      {...overrides}
    />
  )
}

test('mounts the export preview dialog with all three layout slots', () => {
  const markup = renderWorkspace()

  assert.match(markup, /role="dialog"/)
  assert.match(markup, /aria-label="Kept entries list"/)
  assert.match(markup, /aria-label="Export layout canvas"/)
  assert.match(markup, /aria-label="Layout tools"/)
})

test('starts on the first canvas page and reports the continuation total', () => {
  const markup = renderWorkspace()

  assert.match(markup, /Page 1 of 2/)
  assert.match(markup, /data-image-placement-id="kept-image-1"/)
  assert.doesNotMatch(markup, /data-image-placement-id="kept-image-2"/)
})

test('starts image layouts in PNG preview mode and offers text and combined views', () => {
  const markup = renderWorkspace()

  assert.match(markup, /aria-label="Canvas preview mode"/)
  assert.match(markup, /PNG images<\/button>/)
  assert.match(markup, /Kept text<\/button>/)
  assert.match(markup, /Combined<\/button>/)
  assert.match(markup, /aria-pressed="true">PNG images<\/button>/)
})

test('offers bounded canvas zoom controls at seventy percent by default', () => {
  const markup = renderWorkspace()

  assert.match(markup, /aria-label="Canvas zoom"/)
  assert.doesNotMatch(markup, /aria-label="Zoom out"[^>]*disabled=""/)
  assert.doesNotMatch(markup, /aria-label="Zoom in"[^>]*disabled=""/)
  assert.doesNotMatch(markup, /aria-label="Reset canvas zoom"[^>]*disabled=""/)
  assert.match(markup, />70%<\/span>/)
})

test('offers image placements as draggable and resizable canvas targets', () => {
  const markup = renderWorkspace()

  assert.match(markup, /aria-label="Move image: receipt\.png"/)
})

test('keeps delete disabled until a placement is selected', () => {
  const markup = renderWorkspace()
  const label = markup.indexOf('Delete selected')
  const start = markup.lastIndexOf('<button', label)

  assert.match(markup.slice(start, markup.indexOf('>', start) + 1), /disabled=""/)
})

test('resolves uploaded image sources through the supplied resolver', () => {
  const markup = renderWorkspace({
    resolveImageSource: (source) =>
      source.kind === 'uploaded-png'
        ? 'exact-extract-image://project-images/managed.png'
        : undefined
  })

  assert.match(markup, /src="exact-extract-image:\/\/project-images\/managed\.png"/)
})

test('reports a resolution failure without hiding the canvas or its tools', () => {
  const markup = renderWorkspace({ imageResolutionError: 'Source document is unavailable.' })

  assert.match(markup, /role="status"/)
  assert.match(markup, /Entry images could not be generated: Source document is unavailable\./)
  assert.match(markup, /aria-label="Export layout canvas"/)
  assert.match(markup, /aria-label="Layout tools"/)
  assert.match(markup, /data-resolved="false"/)
})

test('shows no resolution status when every image resolves', () => {
  assert.doesNotMatch(renderWorkspace(), /Entry images could not be generated/)
})

test('offers a reset action only when the caller supports it', () => {
  assert.doesNotMatch(renderWorkspace(), /Reset layout/)
  assert.match(renderWorkspace({ onReset: () => {} }), /Reset layout/)
})
