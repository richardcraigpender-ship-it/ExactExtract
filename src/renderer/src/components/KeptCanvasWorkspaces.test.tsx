import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { ProjectEntry } from '../../../shared/contracts'
import type { KeptEntriesCanvasLayout } from '../../../shared/keptEntriesLayout'
import { KeptPngCanvasWorkspace } from './KeptPngCanvasWorkspace'
import { KeptTextCanvasWorkspace } from './KeptTextCanvasWorkspace'
import {
  createDefaultKeptExportTemplateDraft,
  toKeptExportTemplate
} from './keptExportTemplateDraft'

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
      onOpenPngConfiguration={() => {}}
      onOpenTextConfiguration={() => {}}
      onSwitchMode={() => {}}
    />
  )
}

function renderText(): string {
  const draft = createDefaultKeptExportTemplateDraft()
  draft.pageOneTemplate.defaultTextStyle = {
    fontRef: { kind: 'standard-14', family: 'Times-Roman' },
    fontSize: 16,
    color: '#336699',
    fontWeight: 'bold',
    fontStyle: 'italic'
  }
  draft.pageOneTemplate.columns = draft.pageOneTemplate.columns.map((column) => ({
    ...column,
    textStyle: { ...draft.pageOneTemplate.defaultTextStyle }
  }))
  return renderToStaticMarkup(
    <KeptTextCanvasWorkspace
      entries={[entry('first')]}
      layout={layout}
      keptExportTemplate={toKeptExportTemplate(draft)}
      onLayoutChange={() => {}}
      onClose={() => {}}
      onExport={() => {}}
      onOpenConfiguration={() => {}}
      onOpenTextConfiguration={() => {}}
      onOpenPngConfiguration={() => {}}
      onSwitchMode={() => {}}
    />
  )
}

test('neither previewer offers layer-focus controls', () => {
  for (const markup of [renderPng(), renderText()]) {
    assert.doesNotMatch(markup, /Canvas layer focus/)
    assert.doesNotMatch(markup, /data-layer-active/)
  }
})

test('the right-hand entries list panel is removed from both modes', () => {
  for (const markup of [renderPng(), renderText()]) {
    assert.doesNotMatch(markup, /kept-entries-preview-entries/)
    assert.doesNotMatch(markup, /Kept entries list/)
    assert.doesNotMatch(markup, /PLACED IMAGES/)
    assert.doesNotMatch(markup, /kept-png-placement-item/)
  }
})

test('the PNG mode renders images on the canvas and omits the text layer entirely', () => {
  const markup = renderPng()

  assert.match(markup, /Canvas &amp; layout studio/)
  assert.match(markup, /data-image-placement-id="image-1"/)
  assert.doesNotMatch(markup, /data-placement-id="text-1"/)
  assert.doesNotMatch(markup, /Northwind Services/)
})

test('the text mode renders text boxes on the canvas and omits the image layer entirely', () => {
  const markup = renderText()

  assert.match(markup, /Canvas &amp; layout studio/)
  assert.match(markup, /data-placement-id="text-1"/)
  assert.match(markup, /Formatted statement settings/)
  assert.match(markup, /color:#17231c/)
  assert.doesNotMatch(markup, /data-image-placement-id/)
})

test('text mode embeds all formatted statement settings while PNG mode retains layout tools', () => {
  const png = renderPng()
  const text = renderText()

  // Both modes now share the same tool navigation at the top of the left panel.
  for (const markup of [png, text]) {
    assert.match(markup, /role="toolbar" aria-label="Preview tools"/)
    assert.match(markup, />Setup<\/span>/)
    assert.match(markup, />Pages<\/span>/)
    assert.match(markup, />Zoom<\/span>/)
    assert.match(markup, /aria-label="Setup options"/)
  }

  for (const markup of [png]) {
    assert.match(markup, />Place<\/span>/)
    assert.match(markup, />Select<\/span>/)
    assert.match(markup, />Background<\/span>/)
  }

  assert.match(text, /Formatted statement settings/)
  assert.match(text, /Show references under main text/)
  assert.match(text, /Maximum entries per page/)
  assert.match(text, /Page numbers/)
  assert.doesNotMatch(text, />Place<\/span>/)
})

test('the place tab is available for PNG layout editing only', () => {
  const markup = renderPng()
  const index = markup.indexOf('>Place</span>')
  const start = markup.lastIndexOf('<button', index)
  assert.match(markup.slice(start, index), /aria-pressed="false"/)
})

test('both previewers share one studio window with an in-place mode switch', () => {
  const png = renderPng()
  const text = renderText()

  for (const markup of [png, text]) {
    assert.match(markup, /aria-label="Canvas mode"/)
    assert.match(markup, /Formatted Text Statement/)
    assert.match(markup, /PNG Snippet Board/)
  }

  assert.match(
    png,
    /<button type="button" class="mode-button is-active" aria-pressed="true" disabled="">PNG Snippet Board<\/button>/
  )
  assert.match(
    text,
    /<button type="button" class="mode-button is-active" aria-pressed="true" disabled="">Formatted Text Statement<\/button>/
  )
})

test('the text studio embeds configuration and PNG mode retains its configuration button', () => {
  const png = renderPng()
  const text = renderText()

  assert.match(png, /Configure PNG Snippet Board/)
  assert.doesNotMatch(png, /Configure Formatted Text Statement/)
  assert.match(text, /Formatted statement settings/)
  assert.match(text, /Show references under main text/)
  assert.doesNotMatch(text, /Configure PNG Snippet Board/)
})

test('PNG mode embeds its placement settings when the studio can place images', () => {
  const markup = renderToStaticMarkup(
    <KeptPngCanvasWorkspace
      entries={[entry('first')]}
      layout={layout}
      onLayoutChange={() => {}}
      onClose={() => {}}
      onExport={() => {}}
      onPlaceKeptImages={() => {}}
      onSwitchMode={() => {}}
    />
  )

  assert.match(markup, /Place entry images/)
  assert.match(markup, /Balance column/)
  assert.doesNotMatch(markup, /Configure PNG Snippet Board/)
})

test('each mode keeps the tool sidebar to the left of the canvas', () => {
  const png = renderPng()
  const text = renderText()

  assert.ok(
    png.indexOf('kept-entries-preview-context') < png.indexOf('kept-entries-preview-canvas')
  )
  assert.ok(
    text.indexOf('kept-entries-preview-context') < text.indexOf('kept-entries-preview-canvas')
  )
})
