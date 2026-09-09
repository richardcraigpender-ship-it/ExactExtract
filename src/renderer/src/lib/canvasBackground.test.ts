import assert from 'node:assert/strict'
import test from 'node:test'

import type { KeptEntriesBackground } from '../../../shared/keptEntriesLayout'
import {
  fitBackgroundToPage,
  MIN_BACKGROUND_SIZE,
  resizeBackgroundEdge,
  scaleBackground
} from './canvasBackground'

function background(overrides: Partial<KeptEntriesBackground> = {}): KeptEntriesBackground {
  return {
    ref: `${'a'.repeat(64)}.png`,
    x: 10,
    y: 20,
    width: 300,
    height: 400,
    opacity: 1,
    ...overrides
  }
}

test('scales both edges by the same factor and keeps the aspect ratio', () => {
  const scaled = scaleBackground(background(), 1.1)

  assert.equal(scaled.width, 330)
  assert.equal(scaled.height, 440)
  assert.equal(scaled.width / scaled.height, 300 / 400)
})

test('scaling down never collapses the image below the minimum size', () => {
  const scaled = scaleBackground(background({ width: 20, height: 20 }), 0.1)

  assert.equal(scaled.width, MIN_BACKGROUND_SIZE)
  assert.equal(scaled.height, MIN_BACKGROUND_SIZE)
})

test('ignores a scale factor that is not usable', () => {
  const original = background()

  assert.deepEqual(scaleBackground(original, 0), original)
  assert.deepEqual(scaleBackground(original, Number.NaN), original)
})

test('derives the opposite edge when the aspect ratio is locked', () => {
  const byWidth = resizeBackgroundEdge(background(), 'width', 150, true)
  const byHeight = resizeBackgroundEdge(background(), 'height', 200, true)

  assert.deepEqual([byWidth.width, byWidth.height], [150, 200])
  assert.deepEqual([byHeight.width, byHeight.height], [150, 200])
})

test('leaves the opposite edge alone when the aspect ratio is unlocked', () => {
  const resized = resizeBackgroundEdge(background(), 'width', 150, false)

  assert.deepEqual([resized.width, resized.height], [150, 400])
})

test('keeps position untouched when only an edge changes', () => {
  const resized = resizeBackgroundEdge(background(), 'width', 150, true)

  assert.deepEqual([resized.x, resized.y], [10, 20])
})

test('contain-fits a tall image to the page and centres it horizontally', () => {
  const fitted = fitBackgroundToPage(background({ width: 300, height: 400 }), 612, 792)

  assert.equal(fitted.height, 792)
  assert.equal(fitted.width, 594)
  assert.equal(fitted.y, 0)
  assert.equal(fitted.x, (612 - 594) / 2)
})

test('contain-fits a wide image without cropping either edge', () => {
  const fitted = fitBackgroundToPage(background({ width: 1000, height: 200 }), 612, 792)

  assert.equal(fitted.width, 612)
  assert.equal(fitted.height, 122)
  assert.ok(fitted.width <= 612 && fitted.height <= 792)
})

test('refuses to fit an image that reports no usable size', () => {
  const broken = background({ width: 0, height: 0 })

  assert.deepEqual(fitBackgroundToPage(broken, 612, 792), broken)
})
