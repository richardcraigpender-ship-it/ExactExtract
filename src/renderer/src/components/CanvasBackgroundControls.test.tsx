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
        ref: `${'a'.repeat(64)}.png`,
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
  assert.match(markup, /X \(pt\)/)
  assert.match(markup, /Y \(pt\)/)
  assert.match(markup, /Width \(pt\)/)
  assert.match(markup, /Height \(pt\)/)
  assert.match(markup, />Opacity</)
  assert.match(markup, /type="range" min="0" max="1" step="0.05" value="0.65"/)
  assert.match(markup, /title="Remove background image"/)
  assert.match(markup, /title="Replace background image"/)
})

test('offers proportional scaling commands for a selected background', () => {
  const markup = renderToStaticMarkup(
    <CanvasBackgroundControls
      background={{
        ref: `${'a'.repeat(64)}.png`,
        x: 0,
        y: 0,
        width: 300,
        height: 400,
        opacity: 1
      }}
      onChange={() => {}}
    />
  )

  assert.match(markup, /Lock aspect ratio/)
  assert.match(markup, /aria-label="Scale background down"/)
  assert.match(markup, /aria-label="Scale background up"/)
  assert.match(markup, /Fit to page/)
  assert.match(markup, /type="checkbox" checked=""/)
})
