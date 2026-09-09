import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { KeptEntriesExportPreview } from './KeptEntriesExportPreview'

void React

test('renders the header actions and the two composed panel slots', () => {
  const markup = renderToStaticMarkup(
    <KeptEntriesExportPreview
      onClose={() => {}}
      onExport={() => {}}
      canvas={<span>canvas-slot</span>}
      contextPanel={<span>context-slot</span>}
    />
  )

  assert.match(markup, /Kept entries export preview/)
  assert.match(markup, /Export PDF/)
  assert.match(markup, /canvas-slot/)
  assert.match(markup, /context-slot/)
  assert.match(markup, /role="dialog"/)
  assert.match(markup, /aria-modal="true"/)
  assert.match(markup, /aria-label="Close kept entries export preview"/)
  assert.doesNotMatch(markup, /kept-entries-preview-entries/)
})

test('disables the export button and shows progress text while exporting', () => {
  const markup = renderToStaticMarkup(
    <KeptEntriesExportPreview
      onClose={() => {}}
      onExport={() => {}}
      isExporting
      canvas={null}
      contextPanel={null}
    />
  )

  assert.match(markup, /Exporting\.\.\./)
  assert.match(markup, /disabled=""/)
})

test('renders the optional reset layout action', () => {
  const markup = renderToStaticMarkup(
    <KeptEntriesExportPreview
      onClose={() => undefined}
      onExport={() => undefined}
      onReset={() => undefined}
      canvas={null}
      contextPanel={null}
    />
  )

  assert.match(markup, /Reset layout/)
})
