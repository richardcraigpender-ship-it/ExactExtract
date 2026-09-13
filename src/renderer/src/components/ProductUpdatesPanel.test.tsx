import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import { ProductUpdatesPanel } from './ProductUpdatesPanel'
import { PRODUCT_UPDATES } from '../productUpdates'

test('renders dated product changes with meaningful update types', () => {
  const markup = renderToStaticMarkup(<ProductUpdatesPanel />)

  assert.equal(PRODUCT_UPDATES.length, 76)
  assert.match(markup, /What’s new/)
  assert.match(markup, /dateTime="2026-09-13"/)
  assert.match(markup, /Feature/)
  assert.match(markup, /Changed/)
  assert.ok(PRODUCT_UPDATES.some((update) => update.kind === 'Fixed'))
  assert.ok(PRODUCT_UPDATES.some((update) => update.title === 'Canvas & layout studio tools'))
  assert.match(markup, /Reference-safe export spacing/)
  assert.match(markup, /Merchant review rules/)
  assert.match(markup, /View all 76 updates/)
  assert.match(markup, /aria-expanded="false"/)
  assert.doesNotMatch(markup, /Final PDF preview/)
})
