import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { KeptImageSourceDescriptor } from '../../../export'
import { KeptImagePlacementSection } from './KeptImagePlacementSection'

void React

/** Isolates the upload button's own tag so unrelated disabled controls cannot match. */
function uploadButtonTag(markup: string): string {
  const label = markup.indexOf('Add PNG files')
  assert.ok(label > -1, 'expected an upload command')
  const start = markup.lastIndexOf('<button', label)
  return markup.slice(start, markup.indexOf('>', start) + 1)
}

function commandButtonTag(markup: string, label: string): string {
  const index = markup.indexOf(label)
  assert.ok(index > -1, `expected a ${label} command`)
  const start = markup.lastIndexOf('<button', index)
  return markup.slice(start, markup.indexOf('>', start) + 1)
}

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
  assert.doesNotMatch(markup, /type="color"[^>]*disabled=""/)
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

test('disables the upload command when managed storage is unavailable', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection pageSize="letter" orientation="portrait" onPlaceImages={() => {}} />
  )

  assert.match(uploadButtonTag(markup), /disabled=""/)
})

test('offers the upload command once managed storage is wired', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      onPlaceImages={() => {}}
      onUploadPngs={async () => []}
    />
  )

  assert.match(markup, /accept="image\/png" multiple=""/)
  assert.doesNotMatch(uploadButtonTag(markup), /disabled/)
})

test('hides the preview command until a caller supports previewing', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={sessionSources}
      onPlaceImages={() => {}}
    />
  )

  assert.doesNotMatch(markup, /Preview placed images/)
})

test('keeps preview disabled until a plan has been applied to the canvas', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={sessionSources}
      onPlaceImages={() => {}}
      onPreviewPlacedImages={() => {}}
    />
  )

  assert.match(commandButtonTag(markup, 'Preview placed images'), /disabled=""/)
  assert.match(markup, /Place images to preview them on the canvas\./)
})

test('enables preview and reports the placed total once images are on the canvas', () => {
  const markup = renderToStaticMarkup(
    <KeptImagePlacementSection
      pageSize="letter"
      orientation="portrait"
      sessionSources={sessionSources}
      onPlaceImages={() => {}}
      onPreviewPlacedImages={() => {}}
      placedImageCount={2}
    />
  )

  assert.doesNotMatch(commandButtonTag(markup, 'Preview placed images'), /disabled/)
  assert.match(markup, /2 images are on the canvas\./)
})
