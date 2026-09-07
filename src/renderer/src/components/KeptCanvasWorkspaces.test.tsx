import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { ProjectEntry } from '../../../shared/contracts'
import type { KeptEntriesCanvasLayout } from '../../../shared/keptEntriesLayout'
import { KeptPngCanvasWorkspace } from './KeptPngCanvasWorkspace'
import { KeptTextCanvasWorkspace } from './KeptTextCanvasWorkspace'

void React

function entry(id: string): ProjectEntry {
  return {
    id,
    rawText: id,
    normalizedText: `${id} text`,
    source: 'parser',
    status: 'keep',
    confidence: 1,
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x: 20, y: 300, width: 200, height: 20, coordinateSpace: 'pdf-points' }
      }
    ],
    tags: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z'
  }
}

const layout: KeptEntriesCanvasLayout = {
  version: 2,
  pageSize: 'letter',
  orientation: 'portrait',
  placements: [
    {
      id: 'text-1',
      entryId: 'first',
      text: 'Northwind Services',
      pageNumber: 1,
      x: 48,
      y: 48,
      width: 200,
      height: 20,
      rotation: 0,
      fontRef: { kind: 'standard-14', family: 'Helvetica' },
      fontSize: 11,
      color: '#17231c'
    }
  ],
  images: [
    {
      id: 'image-1',
      source: { kind: 'session-entry', ref: 'first' },
      entryId: 'first',
      pageNumber: 1,
      x: 48,
      y: 200,
      width: 240,
      height: 36,
      fit: 'contain'
    }
  ]
}

function renderPng(): string {
  return renderToStaticMarkup(
    <KeptPngCanvasWorkspace
      entries={[entry('first')]}
      layout={layout}
      onLayoutChange={() => {}}
      onClose={() => {}}
      onExport={() => {}}
      onOpenConfiguration={() => {}}
    />
  )
}

function renderText(): string {
  return renderToStaticMarkup(
    <KeptTextCanvasWorkspace
      entries={[entry('first')]}
      layout={layout}
      onLayoutChange={() => {}}
      onClose={() => {}}
      onExport={() => {}}
      onOpenConfiguration={() => {}}
    />
  )
}

test('neither previewer offers layer-focus controls', () => {
  for (const markup of [renderPng(), renderText()]) {
    assert.doesNotMatch(markup, /Canvas layer focus/)
    assert.doesNotMatch(markup, /PNG layer<\/button>/)
    assert.doesNotMatch(markup, /Text layer<\/button>/)
    assert.doesNotMatch(markup, /All layers<\/button>/)
    assert.doesNotMatch(markup, /data-layer-active/)
  }
})

test('the PNG previewer renders images and omits the text layer entirely', () => {
  const markup = renderPng()

  assert.match(markup, /Kept PNG layout preview/)
  assert.match(markup, /data-image-placement-id="image-1"/)
  assert.doesNotMatch(markup, /data-placement-id="text-1"/)
  assert.doesNotMatch(markup, /Northwind Services/)
})

test('the text previewer renders text boxes and omits the image layer entirely', () => {
  const markup = renderText()

  assert.match(markup, /Kept text layout preview/)
  assert.match(markup, /data-placement-id="text-1"/)
  assert.doesNotMatch(markup, /data-image-placement-id/)
})

test('each previewer carries only the tools its layer can use', () => {
  const png = renderPng()
  const text = renderText()

  assert.match(png, /Refresh PNG snapshots/)
  assert.doesNotMatch(png, /Change all entries/)

  assert.doesNotMatch(text, /Refresh PNG snapshots/)
})

test('both previewers share the same pager, zoom, and background base', () => {
  for (const markup of [renderPng(), renderText()]) {
    assert.match(markup, /aria-label="Canvas pages"/)
    assert.match(markup, /aria-label="Canvas zoom"/)
    assert.match(markup, /Page 1 of 1/)
    assert.match(markup, />70%</)
    assert.match(markup, /CANVAS BACKGROUND/)
    assert.match(markup, /Delete selected/)
  }
})

test('each previewer exposes a configuration button and keeps tool controls to the left', () => {
  const png = renderPng()
  const text = renderText()

  assert.match(png, /Configure PNG layout/)
  assert.match(text, /Configure text export/)

  assert.ok(png.indexOf('kept-entries-preview-context') < png.indexOf('kept-entries-preview-entries'))
  assert.ok(text.indexOf('kept-entries-preview-context') < text.indexOf('kept-entries-preview-entries'))
})

test('delete stays disabled until something on the owned layer is selected', () => {
  for (const markup of [renderPng(), renderText()]) {
    const index = markup.indexOf('Delete selected')
    const start = markup.lastIndexOf('<button', index)
    assert.match(markup.slice(start, index), /disabled=""/)
  }
})
