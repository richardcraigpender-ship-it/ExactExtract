import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCanvasPageDimensions,
  getPixelsPerPdfPoint,
  pdfPointsToPixels,
  pixelsToPdfPoints
} from './canvasScale'

test('returns PDF-point dimensions for each page size and orientation', () => {
  assert.deepEqual(getCanvasPageDimensions('letter', 'portrait'), { width: 612, height: 792 })
  assert.deepEqual(getCanvasPageDimensions('letter', 'landscape'), { width: 792, height: 612 })
  assert.deepEqual(getCanvasPageDimensions('a4', 'portrait'), { width: 595.28, height: 841.89 })
  assert.deepEqual(getCanvasPageDimensions('a4', 'landscape'), { width: 841.89, height: 595.28 })
})

test('converts reversibly between canvas pixels and PDF points', () => {
  const scale = getPixelsPerPdfPoint(306, 612)
  assert.equal(scale, 0.5)
  assert.equal(pdfPointsToPixels(144, scale), 72)
  assert.equal(pixelsToPdfPoints(72, scale), 144)
})

test('rejects invalid page and scale dimensions', () => {
  assert.throws(() => getPixelsPerPdfPoint(0, 612), /Canvas width/)
  assert.throws(() => getPixelsPerPdfPoint(612, Number.NaN), /PDF page width/)
  assert.throws(() => pixelsToPdfPoints(20, 0), /Canvas scale/)
})
