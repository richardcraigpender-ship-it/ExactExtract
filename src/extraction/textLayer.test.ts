import assert from 'node:assert/strict'
import test from 'node:test'

import { parseTextLayerPage } from './textLayer'

test('preserves PDF coordinates and produces stable reading order', () => {
  const page = parseTextLayerPage({
    documentId: 'document-1',
    pageNumber: 2,
    width: 612,
    height: 792,
    rotation: 0,
    items: [
      { str: 'right', transform: [1, 0, 0, 10, 200, 700], width: 30, height: 10 },
      { str: 'next line', transform: [1, 0, 0, 10, 40, 650], width: 50, height: 10 },
      { str: '  left  ', transform: [1, 0, 0, 10, 40, 700], width: 25, height: 10 }
    ]
  })

  assert.deepEqual(
    page.blocks.map((block) => block.text),
    ['left', 'right', 'next line']
  )
  assert.deepEqual(
    page.blocks.map((block) => block.id),
    ['document-1:p2:b1', 'document-1:p2:b2', 'document-1:p2:b3']
  )
  assert.deepEqual(page.blocks[0]?.bbox, {
    x: 40,
    y: 698,
    width: 25,
    height: 10,
    coordinateSpace: 'pdf-points'
  })
})

test('uses font ascent to place a text box around the printed glyph band', () => {
  const page = parseTextLayerPage({
    documentId: 'document-1',
    pageNumber: 1,
    width: 100,
    height: 100,
    rotation: 0,
    items: [
      {
        str: 'Text',
        transform: [1, 0, 0, 10, 20, 50],
        width: 30,
        height: 10,
        fontAscentRatio: 0.75
      }
    ]
  })

  assert.equal(page.blocks[0]?.bbox.y, 47.5)
})

test('drops blank and non-finite text items', () => {
  const page = parseTextLayerPage({
    documentId: 'document-1',
    pageNumber: 1,
    width: 100,
    height: 100,
    rotation: 0,
    items: [
      { str: '   ', transform: [1, 0, 0, 10, 0, 10], width: 10, height: 10 },
      { str: 'invalid', transform: [1, 0, 0, 10, Number.NaN, 10], width: 10, height: 10 }
    ]
  })

  assert.equal(page.blocks.length, 0)
  assert.equal(page.characterCount, 0)
})

test('rejects invalid page metadata', () => {
  assert.throws(
    () =>
      parseTextLayerPage({
        documentId: '',
        pageNumber: 0,
        width: 0,
        height: 100,
        rotation: 0,
        items: []
      }),
    /documentId/
  )
})
