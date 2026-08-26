import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CanvasBackgroundControls } from './CanvasBackgroundControls'

void React

test('renders upload-only background controls without a selected image', () => {
  const markup = renderToStaticMarkup(
    <CanvasBackgroundControls background={undefined} onChange={() => {}} />
  )

  assert.match(markup, /Background image/)
  assert.match(markup, /Add background image/)
  assert.match(markup, /accept="image\/png,image\/jpeg,image\/webp"/)
})

test('renders precise placement and opacity controls for a selected background', () => {
  const markup = renderToStaticMarkup(
    <CanvasBackgroundControls
      label="Later pages background"
      background={{
        dataUrl: 'data:image/png;base64,preview',
        x: 12,
        y: 24,
        width: 300,
        height: 400,
        opacity: 0.65
      }}
      onChange={() => {}}
    />
  )

  assert.match(markup, /Later pages background/)
  assert.match(markup, /Selected canvas background/)
  assert.match(markup, />X</)
  assert.match(markup, />Y</)
  assert.match(markup, />width</)
  assert.match(markup, />height</)
  assert.match(markup, />Opacity</)
  assert.match(markup, /type="range" min="0" max="1" step="0.05" value="0.65"/)
  assert.match(markup, /title="Remove background image"/)
  assert.match(markup, /title="Replace background image"/)
})
