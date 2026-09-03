import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_KEPT_EXPORT_PAGE_NUMBERS } from '../shared/keptExportTemplate'
import { buildPageNumberDraw, formatPageNumberText, resolvePageNumberPosition } from './pageNumbers'

const measure = (text: string, fontSize: number): number => text.length * fontSize * 0.5

test('formats {n} and {total} placeholders relative to the configured start number', () => {
  assert.equal(formatPageNumberText('Page {n} of {total}', 1, 5, 12), 'Page 5 of 12')
  assert.equal(formatPageNumberText('{n}', 3, 5, 12), '7')
})

test('positions bottom-center text centered horizontally with a margin from the bottom edge', () => {
  const position = resolvePageNumberPosition('bottom-center', 0, 24, 612, 792, 20)
  assert.deepEqual(position, { x: (612 - 20) / 2, y: 24 })
})

test('positions top-right text against the right and top edges using the offsets as margins', () => {
  const position = resolvePageNumberPosition('top-right', 10, 30, 612, 792, 20)
  assert.deepEqual(position, { x: 612 - 10 - 20, y: 792 - 30 })
})

test('returns undefined when page numbers are disabled', () => {
  const draw = buildPageNumberDraw(
    { ...DEFAULT_KEPT_EXPORT_PAGE_NUMBERS, enabled: false },
    1,
    3,
    612,
    792,
    measure
  )
  assert.equal(draw, undefined)
})

test('scales the font size and reflects it in the measured text width', () => {
  const draw = buildPageNumberDraw(
    { ...DEFAULT_KEPT_EXPORT_PAGE_NUMBERS, enabled: true, scale: 2 },
    1,
    3,
    612,
    792,
    measure
  )
  assert.ok(draw)
  assert.equal(draw?.fontSize, DEFAULT_KEPT_EXPORT_PAGE_NUMBERS.textStyle.fontSize * 2)
  assert.equal(draw?.text, '1')
})
