import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { KeptEntriesCanvasLayout } from '../../../shared/keptEntriesLayout'
import { ExportCanvas } from './ExportCanvas'

void React

const imageLayout: KeptEntriesCanvasLayout = {
  version: 2,
  pageSize: 'letter',
  orientation: 'portrait',
  pageCount: 2,
  placements: [],
  images: [
    {
      id: 'kept-image-1',
      source: { kind: 'session-entry', ref: 'entry-1' },
      entryId: 'entry-1',
      pageNumber: 1,
      x: 48,
      y: 48,
      width: 240,
      height: 120,
      fit: 'contain'
    },
    {
      id: 'kept-image-2',
      source: { kind: 'uploaded-png', ref: 'receipt.png' },
      pageNumber: 2,
      x: 48,
      y: 48,
      width: 240,
      height: 120,
      fit: 'stretch'
    }
  ]
}

test('renders only the requested page of image placements', () => {
  const markup = renderToStaticMarkup(<ExportCanvas layout={imageLayout} />)

  assert.match(markup, /data-image-placement-id="kept-image-1"/)
  assert.doesNotMatch(markup, /data-image-placement-id="kept-image-2"/)
  assert.match(markup, /data-source-kind="session-entry"/)
  assert.match(markup, /left:7.8431372549019605%/)
})

test('renders continuation pages when a later page is requested', () => {
  const markup = renderToStaticMarkup(<ExportCanvas layout={imageLayout} pageNumber={2} />)

  assert.match(markup, /data-image-placement-id="kept-image-2"/)
  assert.doesNotMatch(markup, /data-image-placement-id="kept-image-1"/)
  assert.match(markup, /data-fit="stretch"/)
})

test('falls back to a labelled placeholder when image bytes are unresolved', () => {
  const markup = renderToStaticMarkup(<ExportCanvas layout={imageLayout} />)

  assert.match(markup, /class="export-canvas-image-placeholder">entry-1 \(image not available\)</)
  assert.match(markup, /data-resolved="false"/)
  assert.doesNotMatch(markup, /<img src/)
})

test('renders resolved image bytes when the caller supplies a source', () => {
  const markup = renderToStaticMarkup(
    <ExportCanvas
      layout={imageLayout}
      resolveImageSource={(source) =>
        source.ref === 'entry-1' ? 'data:image/png;base64,resolved' : undefined
      }
    />
  )

  assert.match(markup, /<img src="data:image\/png;base64,resolved"/)
  assert.doesNotMatch(markup, /export-canvas-image-placeholder/)
})

test('exposes move and resize affordances for a selected image placement', () => {
  const markup = renderToStaticMarkup(
    <ExportCanvas
      layout={imageLayout}
      selectedImagePlacementId="kept-image-1"
      onSelectImagePlacement={() => {}}
      onImagePlacementChange={() => {}}
    />
  )

  assert.match(markup, /aria-label="Selected. Move image: entry-1"/)
  assert.match(markup, /aria-label="Resize image: entry-1"/)
  assert.match(markup, /export-canvas-image is-selected/)
})

test('keeps image placements static when no interaction callbacks are supplied', () => {
  const markup = renderToStaticMarkup(<ExportCanvas layout={imageLayout} />)

  assert.doesNotMatch(markup, /aria-label="Move image: entry-1"/)
  assert.doesNotMatch(markup, /aria-label="Resize image: entry-1"/)
})

test('keeps existing text placements visible alongside image placements', () => {
  const markup = renderToStaticMarkup(
    <ExportCanvas
      layout={{
        ...imageLayout,
        placements: [
          {
            id: 'placement-1',
            entryId: 'entry-1',
            text: 'Invoice total 120.00',
            x: 48,
            y: 400,
            width: 300,
            height: 24,
            rotation: 0,
            fontRef: { kind: 'standard-14', family: 'Helvetica' },
            fontSize: 11,
            color: '#17231c'
          }
        ]
      }}
    />
  )

  assert.match(markup, /data-placement-id="placement-1"/)
  assert.match(markup, /data-image-placement-id="kept-image-1"/)
})
