import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { KeptImageSourceDescriptor } from '../../../export'
import { KeptImagePlacementSection, sampleDocumentTextStyle } from './KeptImagePlacementSection'

void React

const sessionSources: KeptImageSourceDescriptor[] = [
  {
    kind: 'session-entry',
    ref: 'entry-1',
    entryId: 'entry-1',
    name: '2026-03-17-1.png',
    naturalWidth: 240,
    naturalHeight: 60
  },
  {
    kind: 'session-entry',
    ref: 'entry-2',
    entryId: 'entry-2',
    name: '2026-03-18-1.png',
    naturalWidth: 240,
    naturalHeight: 60
  }
]

test('offers divider controls that stay disabled until the divider is enabled', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={sessionSources}
      onPlaceImages={() => {}}
      onPreviewPlacedImages={() => {}}
    />
  )

  assert.match(markup, /Entry divider/)
  assert.match(markup, /Show a divider after every image/)
  assert.match(markup, /Thickness \(pt\)/)
  assert.match(markup, /Opacity/)
  assert.match(markup, /type="color"[^>]*disabled=""/)
})

test('enables the divider fields once the divider is turned on', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={sessionSources}
      onPlaceImages={() => {}}
      initialOptions={{
        sourceMode: 'session-entry',
        startX: 48,
        startY: 48,
        fillBetweenY: false,
        entriesPerPage: 6,
        gap: 12,
        preserveAspectRatio: true,
        uniformSlots: false,
        divider: {
          enabled: true,
          startX: 40,
          endX: 300,
          width: 260,
          thickness: 2,
          color: '#336699',
          opacity: 0.5
        }
      }}
    />
  )

  assert.match(markup, /value="#336699"/)
  const enabledColorCount = (markup.match(/type="color"/g) ?? []).length
  const disabledColorCount = (markup.match(/type="color"[^>]*disabled=""/g) ?? []).length
  assert.equal(enabledColorCount - disabledColorCount, 1)
})

test('offers both image sources and the documented placement controls', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={sessionSources}
      onPlaceImages={() => {}}
      onPreviewPlacedImages={() => {}}
    />
  )

  assert.match(markup, /Place entry images/)
  assert.match(markup, /Use PNG entries from this session \(2\)/)
  assert.match(markup, /Upload PNG files \(0\)/)
  assert.match(markup, /Start X \(pt\)/)
  assert.match(markup, /Start Y \(pt\)/)
  assert.match(markup, /End Y \(pt\)/)
  assert.match(markup, /Entries per page/)
  assert.match(markup, /Vertical gap \(pt\)/)
  assert.match(markup, /Width \(pt, optional\)/)
  assert.match(markup, /Height \(pt, optional\)/)
  assert.match(markup, /Preserve aspect ratio/)
  assert.match(markup, /Uniform crop dimensions/)
  assert.match(markup, /Fill between Start Y and End Y/)
  assert.match(markup, /Place images/)
  assert.match(markup, /Edit placed images/)
})

test('reports the planned placement and page totals before the canvas changes', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={sessionSources}
      onPlaceImages={() => {}}
    />
  )

  assert.match(markup, /2 images across 1 page\./)
})

test('disables session images and the place command when no kept entries exist', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection pageSize="letter" orientation="portrait" onPlaceImages={() => {}} />
  )

  assert.match(markup, /<input type="radio" disabled="" name="kept-image-source"\/>/)
  assert.match(markup, /Keep at least one entry with a source region/)
  assert.match(markup, /No images are ready to place\./)
  assert.match(markup, /There are no images to place\./)
  assert.match(markup, /<button class="secondary-button" type="button" disabled="">/)
})

test('surfaces planner warnings for sources that cannot be placed', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={[
        {
          kind: 'session-entry',
          ref: 'entry-3',
          name: 'broken.png',
          naturalWidth: 0,
          naturalHeight: 0
        }
      ]}
      onPlaceImages={() => {}}
    />
  )

  assert.match(markup, /aria-label="Image placement warnings"/)
  assert.match(markup, /broken\.png has no usable size/)
})

test('offers balance-column controls and keeps them disabled until enabled', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={sessionSources}
      onPlaceImages={() => {}}
    />
  )

  assert.match(markup, /Balance column/)
  assert.match(markup, /Show running balance beside each session image/)
  assert.match(markup, /Horizontal offset \(pt\)/)
  assert.match(markup, /Vertical offset \(pt\)/)
  assert.match(markup, /Font size/)
  assert.match(markup, /type="color"[^>]*disabled=""/)
})

test('enables balance-column fields when the toggle is on', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={sessionSources}
      onPlaceImages={() => {}}
      initialOptions={{
        sourceMode: 'session-entry',
        startX: 48,
        startY: 48,
        fillBetweenY: false,
        entriesPerPage: 6,
        gap: 12,
        preserveAspectRatio: true,
        uniformSlots: false,
        runningBalance: {
          enabled: true,
          offsetX: 8,
          offsetY: 4,
          fontSize: 12,
          color: '#336699',
          fontFamily: 'Consolas',
          fontWeight: '700',
          backgroundColor: '#fcfbfa'
        }
      }}
    />
  )

  assert.match(markup, /value="#336699"/)
  assert.match(markup, /value="12"/)
  assert.match(markup, /Consolas \(Monospace \/ Receipt\)/)
  assert.match(markup, /Bold \(700\)/)
  assert.match(markup, /Document cream \(#fcfbfa\)/)
  assert.match(markup, /Match source document style/)
})

test('samples document text style from source document style profile', () => {
  const documents = [
    {
      styleProfile: {
        id: 'sp1',
        documentId: 'doc1',
        generatedAt: '2026-09-08',
        detectorVersion: 1 as const,
        source: 'digital' as const,
        confidence: 'high' as const,
        textStyles: [
          {
            id: 'ts1',
            fontFamily: 'Courier',
            fontSize: 9.5,
            fontWeight: 'bold' as const,
            italic: false,
            underline: false,
            colour: { hex: '#222222', name: 'Dark Gray' },
            role: 'body' as const,
            likelyRole: 'body' as const,
            occurrenceCount: 10,
            characterCount: 500,
            pageNumbers: [1],
            sampleText: ['sample']
          }
        ],
        dividerStyles: [],
        colourPalette: [],
        pageSummaries: [],
        warnings: []
      }
    }
  ]

  const sampled = sampleDocumentTextStyle(documents)
  assert.deepEqual(sampled, {
    fontFamily: 'Courier New',
    fontWeight: '700',
    fontSize: 10,
    color: '#222222'
  })
})

test('offers page-number controls that stay disabled until page numbers are enabled', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={sessionSources}
      onPlaceImages={() => {}}
    />
  )

  assert.match(markup, /Page numbers/)
  assert.match(markup, /Add page numbers/)
  assert.match(markup, /Start at/)
  assert.match(markup, /Horizontal offset \(pt\)/)
  assert.doesNotMatch(markup, /Match source page numbers/)
})

test('offers the detect wizard only when a detect handler is supplied', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={sessionSources}
      onPlaceImages={() => {}}
      onDetectPageNumbers={async () => undefined}
    />
  )

  assert.match(markup, /Match source page numbers/)
})

test('enables page-number fields when page numbers are already configured', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={sessionSources}
      onPlaceImages={() => {}}
      initialPageNumbers={{
        enabled: true,
        matchSourceStyle: false,
        anchor: 'bottom-center',
        offsetX: 0,
        offsetY: 24,
        format: { template: '{n}', startAt: 1 },
        textStyle: {
          fontRef: { kind: 'standard-14', family: 'Helvetica' },
          fontSize: 9,
          color: '#657067',
          fontWeight: 'normal',
          fontStyle: 'normal'
        },
        scale: 1
      }}
    />
  )

  assert.match(markup, /value="#657067"/)
  assert.match(markup, /<input type="checkbox" checked=""/)
})
