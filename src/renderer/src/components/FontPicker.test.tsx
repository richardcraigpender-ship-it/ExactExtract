import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import { FontPicker } from './FontPicker'

test('shows a platform-unsupported notice when Local Font Access is unavailable', () => {
  delete (globalThis as { window?: unknown }).window
  const markup = renderToStaticMarkup(<FontPicker value={null} onChange={() => {}} />)

  assert.match(markup, /System font browsing/)
  assert.match(markup, /available on this platform/)
  assert.doesNotMatch(markup, /Browse system fonts/)
})

test('offers a browse action when Local Font Access is available', () => {
  ;(globalThis as { window?: unknown }).window = { queryLocalFonts: async () => [] }
  try {
    const markup = renderToStaticMarkup(<FontPicker value={null} onChange={() => {}} />)
    assert.match(markup, /Browse system fonts/)
  } finally {
    delete (globalThis as { window?: unknown }).window
  }
})
