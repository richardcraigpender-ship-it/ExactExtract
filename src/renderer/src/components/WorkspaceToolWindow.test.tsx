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
  assert.match(markup, /aria-label="Close Template preview"/)

  const labelledBy = /aria-labelledby="([^"]+)"/.exec(markup)?.[1]
  assert.ok(labelledBy)
  assert.match(markup, new RegExp(`<h2 id="${labelledBy}">Template preview</h2>`))
})

test('gives stacked tool windows distinct title ids', () => {
  const markup = renderToStaticMarkup(
    <>
      <WorkspaceToolWindow title="Final PDF preview" onClose={() => undefined}>
        <button type="button">Preview action</button>
      </WorkspaceToolWindow>
      <WorkspaceToolWindow title="Configure kept export" onClose={() => undefined}>
        <button type="button">Configure action</button>
      </WorkspaceToolWindow>
    </>
  )

  const ids = [...markup.matchAll(/aria-labelledby="([^"]+)"/g)].map((match) => match[1])
  assert.equal(ids.length, 2)
  assert.notEqual(ids[0], ids[1])
})
