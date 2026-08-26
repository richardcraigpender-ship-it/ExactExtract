import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RemovePagesPanel } from './RemovePagesPanel'

void React

test('offers current-page and range removal without allowing all pages to be removed', () => {
  const markup = renderToStaticMarkup(
    <RemovePagesPanel currentPage={3} pageCount={10} onRemovePages={() => {}} />
  )

  assert.match(markup, /Remove source pages/)
  assert.match(markup, /Use current page \(3\)/)
  assert.match(markup, /placeholder="Example: 3-6, 9"/)
  assert.match(markup, /Remove 1 page/)
})
