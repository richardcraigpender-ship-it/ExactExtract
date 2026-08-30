import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  keptEntriesPageDimensions,
  type KeptEntriesCanvasLayout,
  type KeptEntriesOrientation,
  type KeptEntriesPageSize
} from '../../../shared/keptEntriesLayout'
import { ExportCanvas } from './ExportCanvas'

void React

/** Derived from the shared page contract so a change there cannot silently pass this suite. */
function expectedAspectRatio(
  pageSize: KeptEntriesPageSize,
  orientation: KeptEntriesOrientation
): string {
  const page = keptEntriesPageDimensions(pageSize, orientation)
  return `aspect-ratio:${page.width} / ${page.height}`
}

const layout: KeptEntriesCanvasLayout = {
  version: 1,
  pageSize: 'letter',
  orientation: 'portrait',
  background: {
    dataUrl: 'data:image/png;base64,preview',
    x: 0,
    y: 0,
    width: 612,
    height: 792,
    opacity: 0.4
  },
  placements: [
    {
      id: 'placement-1',
      entryId: 'entry-1',
      text: 'Invoice total 120.00',
      x: 48,
      y: 72,
      width: 516,
      height: 28,
      rotation: 2,
      fontRef: { kind: 'standard-14', family: 'Helvetica-Bold' },
      fontSize: 11,
      color: '#17231c'
    }
  ]
}

test('renders a layered responsive page from PDF-point placement data', () => {
  const markup = renderToStaticMarkup(<ExportCanvas layout={layout} />)

  assert.match(markup, /data-page-size="letter"/)
  assert.match(markup, /data-orientation="portrait"/)
  assert.ok(
    markup.includes(expectedAspectRatio('letter', 'portrait')),
    'expected the shared letter portrait aspect ratio'
  )
  assert.match(markup, /class="export-canvas-background"/)
  assert.match(markup, /opacity:0.4/)
  assert.match(markup, /data-placement-id="placement-1"/)
  assert.match(markup, /data-entry-id="entry-1"/)
  assert.match(markup, /left:7.8431372549019605%/)
  assert.match(markup, /top:9.090909090909092%/)
  assert.match(markup, /font-weight:700/)
  assert.match(markup, /rotate\(2deg\)/)
  assert.ok(markup.indexOf('export-canvas-background') < markup.indexOf('export-canvas-content'))
})

test('uses landscape dimensions and renders system-font free text', () => {
  const markup = renderToStaticMarkup(
    <ExportCanvas
      layout={{
        ...layout,
        pageSize: 'a4',
        orientation: 'landscape',
        background: undefined,
        placements: [
          {
            ...layout.placements[0]!,
            id: 'free-text',
            entryId: undefined,
            text: 'Quarterly report',
            fontRef: { kind: 'system', family: 'Example Sans', style: 'Bold Italic' }
          }
        ]
      }}
    />
  )

  assert.ok(
    markup.includes(expectedAspectRatio('a4', 'landscape')),
    'expected the shared A4 landscape aspect ratio'
  )
  assert.match(markup, /font-family:&quot;Example Sans&quot;/)
  assert.match(markup, /font-style:italic/)
  assert.match(markup, /font-weight:700/)
  assert.doesNotMatch(markup, /export-canvas-background/)
})

test('exposes controlled move and resize affordances for the selected placement', () => {
  const markup = renderToStaticMarkup(
    <ExportCanvas
      layout={layout}
      selectedPlacementId="placement-1"
      onSelectPlacement={() => {}}
      onPlacementChange={() => {}}
    />
  )

  assert.match(markup, /role="region"/)
  assert.match(markup, /role="group"/)
  assert.match(markup, /role="button"/)
  assert.match(markup, /Selected. Move text box: Invoice total 120.00/)
  assert.match(markup, /Resize text box: Invoice total 120.00/)
  assert.match(markup, /export-canvas-resize-handle/)
})

test('exposes canvas drop and editable background affordances', () => {
  const markup = renderToStaticMarkup(
    <ExportCanvas layout={layout} onDropEntry={() => {}} onBackgroundChange={() => {}} />
  )

  assert.match(markup, /export-canvas-background is-editable/)
  assert.match(markup, /aria-label="Move canvas background"/)
  assert.match(markup, /aria-label="Resize canvas background"/)
})
