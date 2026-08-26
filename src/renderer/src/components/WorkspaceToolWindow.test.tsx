import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WorkspaceToolWindow } from './WorkspaceToolWindow'

void React

test('renders a labelled modal dialog with an explicit close control', () => {
  const markup = renderToStaticMarkup(
    <WorkspaceToolWindow title="Template preview" onClose={() => undefined}>
      <button type="button">Preview action</button>
    </WorkspaceToolWindow>
  )

  assert.match(markup, /role="dialog"/)
  assert.match(markup, /aria-modal="true"/)
  assert.match(markup, /aria-labelledby="workspace-tool-title"/)
  assert.match(markup, /aria-label="Close Template preview"/)
})
