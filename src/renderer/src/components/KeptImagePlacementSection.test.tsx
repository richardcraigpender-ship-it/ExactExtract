import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { KeptImageSourceDescriptor } from '../../../export'
import { KeptImagePlacementSection } from './KeptImagePlacementSection'

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
          color: '#336699'
        }
      }}
    />
  )

  assert.match(markup, /value="#336699"/)
  assert.match(markup, /value="12"/)
})
