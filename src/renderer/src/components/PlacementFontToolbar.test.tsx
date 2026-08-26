import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { KeptEntryPlacement } from '../../../shared/keptEntriesLayout'
import { PlacementFontToolbar } from './PlacementFontToolbar'

void React

const placement: KeptEntryPlacement = {
  id: 'placement-1',
  text: 'Entry',
  x: 40,
  y: 50,
  width: 100,
  height: 30,
  rotation: 0,
  fontRef: { kind: 'standard-14', family: 'Helvetica' },
  fontSize: 11,
  color: '#17231c'
}

test('renders an empty state until a text box is selected', () => {
  assert.match(
    renderToStaticMarkup(<PlacementFontToolbar placement={null} onChange={() => {}} />),
    /Select a text box/
  )
})

test('renders font, size, color, rotation, and system font controls', () => {
  const markup = renderToStaticMarkup(
    <PlacementFontToolbar placement={placement} onChange={() => {}} />
  )
  assert.match(markup, /Selected text formatting/)
  assert.match(markup, /Helvetica-Bold/)
  assert.match(markup, /Times-Roman/)
  assert.match(markup, /type="number"/)
  assert.match(markup, /type="color"/)
  assert.match(markup, />Rotation</)
  assert.match(markup, /min="-180" max="180"/)
  assert.match(markup, /System font browsing/)
})

test('renders the optional change-all-entries control', () => {
  const markup = renderToStaticMarkup(
    <PlacementFontToolbar
      placement={placement}
      onChange={() => undefined}
      applyToAll
      onApplyToAllChange={() => undefined}
    />
  )

  assert.match(markup, /Change all entries/)
  assert.match(markup, /checked=""/)
})
