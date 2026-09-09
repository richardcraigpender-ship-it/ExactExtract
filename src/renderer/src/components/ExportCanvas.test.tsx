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
    ref: `${'a'.repeat(64)}.png`,
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

test('renders the template render plan instead of static placements when provided', () => {
  const templatePage = {
    pageNumber: 1,
    template: {
      pageSize: 'letter',
      orientation: 'portrait',
      layoutMode: 'table-row',
      entriesPerPage: 20,
      defaultTextStyle: {
        fontRef: { kind: 'standard-14', family: 'Helvetica' },
        fontSize: 10,
        color: '#112233',
        fontWeight: 'normal',
        fontStyle: 'normal'
      },
      columns: []
    },
    placements: [
      {
        entryId: 'entry-1',
        columnId: 'payee',
        pageNumber: 1,
        text: 'TEMPLATE PAYEE ROW',
        x: 48,
        y: 100,
        width: 200,
        height: 12,
        style: {
          fontRef: { kind: 'standard-14', family: 'Helvetica' },
          fontSize: 10,
          color: '#112233',
          fontWeight: 'bold',
          fontStyle: 'normal'
        }
      }
    ],
    dividers: [
      {
        entryId: 'entry-1',
        pageNumber: 1,
        startX: 40,
        endX: 300,
        y: 120,
        thickness: 2,
        color: '#336699',
        opacity: 0.5
      }
    ]
  } as never

  const markup = renderToStaticMarkup(<ExportCanvas layout={layout} templatePage={templatePage} />)

  assert.match(markup, /TEMPLATE PAYEE ROW/)
  assert.match(markup, /data-column-id="payee"/)
  assert.match(markup, /color:#112233/)
  assert.match(markup, /export-canvas-image-divider/)
  assert.match(markup, /border-top:2px solid #336699/)
  assert.doesNotMatch(markup, /data-placement-id="placement-1"/)
  assert.doesNotMatch(markup, /Invoice total 120\.00/)
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

test('renders image dividers in the canvas preview', () => {
  const markup = renderToStaticMarkup(
    <ExportCanvas
      layout={{
        ...layout,
        version: 2,
        placements: [],
        imagePlacementOptions: {
          sourceMode: 'uploaded-png',
          startX: 48,
          startY: 72,
          fillBetweenY: false,
          entriesPerPage: 4,
          gap: 12,
          preserveAspectRatio: true,
          uniformSlots: false,
          divider: {
            enabled: true,
            width: 260,
            thickness: 2,
            color: '#336699',
            opacity: 0.5,
            startX: 40,
            endX: 300
          }
        },
        images: [
          {
            id: 'image-1',
            source: { kind: 'uploaded-png', ref: 'image-1' },
            pageNumber: 1,
            x: 48,
            y: 72,
            width: 200,
            height: 100,
            fit: 'contain'
          }
        ]
      }}
    />
  )

  assert.match(markup, /export-canvas-image-divider/)
  assert.match(markup, /border-top:2px solid #336699/)
  assert.match(markup, /opacity:0.5/)
})

test('renders running balance text next to image placements when enabled', () => {
  const markup = renderToStaticMarkup(
    <ExportCanvas
      layout={{
        ...layout,
        version: 2,
        placements: [],
        imagePlacementOptions: {
          sourceMode: 'session-entry',
          startX: 48,
          startY: 72,
          fillBetweenY: false,
          entriesPerPage: 4,
          gap: 12,
          preserveAspectRatio: true,
          uniformSlots: false,
          runningBalance: {
            enabled: true,
            offsetX: 8,
            offsetY: 4,
            fontSize: 10,
            color: '#17231c'
          }
        },
        images: [
          {
            id: 'image-1',
            source: { kind: 'session-entry', ref: 'entry-1' },
            entryId: 'entry-1',
            pageNumber: 1,
            x: 48,
            y: 72,
            width: 200,
            height: 100,
            fit: 'contain',
            runningBalanceText: '£95.00'
          }
        ]
      }}
    />
  )

  assert.match(markup, /export-canvas-image-balance/)
  assert.match(markup, /£95\.00/)
})

test('hides running balance text when the balance column is disabled', () => {
  const markup = renderToStaticMarkup(
    <ExportCanvas
      layout={{
        ...layout,
        version: 2,
        placements: [],
        imagePlacementOptions: {
          sourceMode: 'session-entry',
          startX: 48,
          startY: 72,
          fillBetweenY: false,
          entriesPerPage: 4,
          gap: 12,
          preserveAspectRatio: true,
          uniformSlots: false,
          runningBalance: {
            enabled: false,
            offsetX: 8,
            offsetY: 4,
            fontSize: 10,
            color: '#17231c'
          }
        },
        images: [
          {
            id: 'image-1',
            source: { kind: 'session-entry', ref: 'entry-1' },
            entryId: 'entry-1',
            pageNumber: 1,
            x: 48,
            y: 72,
            width: 200,
            height: 100,
            fit: 'contain',
            runningBalanceText: '£95.00'
          }
        ]
      }}
    />
  )

  assert.doesNotMatch(markup, /export-canvas-image-balance/)
})
