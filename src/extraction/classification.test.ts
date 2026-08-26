import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyPage } from './classification'
import { parseTextLayerPage } from './textLayer'
import type { ParsedPage } from './types'

function page(text: string, images = 0, rotation: 0 | 90 | 180 | 270 = 0): ParsedPage {
  return parseTextLayerPage({
    documentId: 'document-1',
    pageNumber: 1,
    width: 612,
    height: 792,
    rotation,
    imageObjectCount: images,
    items: text ? [{ str: text, transform: [1, 0, 0, 10, 40, 700], width: 200, height: 10 }] : []
  })
}

test('classifies digital, scanned, sparse, and mixed pages', () => {
  assert.equal(classifyPage(page('A'.repeat(250), 1)).kind, 'text')
  assert.equal(classifyPage(page('', 1)).kind, 'image')
  assert.equal(classifyPage(page('short')).kind, 'sparse')
  assert.equal(classifyPage(page('A'.repeat(80), 2)).kind, 'mixed')
})

test('marks scanned and sparse pages for OCR', () => {
  assert.equal(classifyPage(page('', 2)).ocrRecommended, true)
  assert.equal(classifyPage(page('tiny')).ocrRecommended, true)
  assert.equal(classifyPage(page('A'.repeat(250))).ocrRecommended, false)
})

test('preserves rotated pages as a distinct classification', () => {
  const classified = classifyPage(page('A'.repeat(100), 0, 90))
  assert.equal(classified.kind, 'rotated')
  assert.equal(classified.rotation, 90)
})
