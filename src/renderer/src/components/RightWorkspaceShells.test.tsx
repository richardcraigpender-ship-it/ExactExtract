import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import { PagePreviewStrip } from './PagePreviewStrip'
import { WorkspaceToolWindow } from './WorkspaceToolWindow'

test('renders a labelled modal tool window with an explicit close command', () => {
  const markup = renderToStaticMarkup(
    <WorkspaceToolWindow title="Zoom and rotate" onClose={() => {}}>
      <p>Zoom controls</p>
    </WorkspaceToolWindow>
  )

  assert.match(markup, /role="dialog"/)
  assert.match(markup, /aria-modal="true"/)
  assert.match(markup, /aria-label="Close Zoom and rotate"/)
  assert.match(markup, /Zoom controls/)
})

test('renders page commands horizontally with the current page exposed', () => {
  const markup = renderToStaticMarkup(
    <PagePreviewStrip pageCount={3} currentPage={2} onSelectPage={() => {}} />
  )

  assert.match(markup, /aria-label="Go to page 1"/)
  assert.match(markup, /aria-label="Go to page 2"[^>]*aria-current="page"/)
  assert.match(markup, /aria-label="Go to page 3"/)
})
