import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import { ProductUpdatesPanel } from './ProductUpdatesPanel'
import { PRODUCT_UPDATES } from '../productUpdates'

test('renders dated product changes with meaningful update types', () => {
  const markup = renderToStaticMarkup(<ProductUpdatesPanel />)

  assert.equal(PRODUCT_UPDATES.length, 54)
  assert.match(markup, /What’s new/)
  assert.match(markup, /dateTime="2026-08-30"/)
  assert.match(markup, /Feature/)
  assert.match(markup, /Changed/)
  assert.match(markup, /Fixed/)
  assert.match(markup, /Kept image layouts/)
  assert.match(markup, /View all 54 updates/)
  assert.match(markup, /aria-expanded="false"/)
  assert.doesNotMatch(markup, /Final PDF preview/)
})
