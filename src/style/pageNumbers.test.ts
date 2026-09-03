import assert from 'node:assert/strict'
import test from 'node:test'

import { detectPageNumberStyle } from './pageNumbers'
import type { PageNumberScanPage } from './pageNumbers'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792

function pageWithNumber(pageNumber: number, text: string): PageNumberScanPage {
  return {
    pageNumber,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    lines: [
      {
        text: 'Statement body text goes here.',
        bbox: { x: 48, y: 400, width: 200, height: 12, coordinateSpace: 'pdf-points' }
      },
      { text, bbox: { x: 280, y: 30, width: 40, height: 10, coordinateSpace: 'pdf-points' } }
    ]
  }
}

test('detects a consistent bottom-center page number sequence', () => {
  const pages = [1, 2, 3, 4].map((pageNumber) => pageWithNumber(pageNumber, `${pageNumber}`))
  const match = detectPageNumberStyle(pages)

  assert.ok(match)
  assert.equal(match?.anchor, 'bottom-center')
  assert.equal(match?.format.template, '{n}')
  assert.equal(match?.format.startAt, 1)
  assert.equal(match?.matchedPageCount, 4)
})

test('detects "Page X of Y" formatting and preserves the total placeholder', () => {
  const pages = [1, 2, 3].map((pageNumber) => pageWithNumber(pageNumber, `Page ${pageNumber} of 3`))
  const match = detectPageNumberStyle(pages)

  assert.ok(match)
  assert.equal(match?.format.template, 'Page {n} of {total}')
})

test('does not match when numbers are not a consistent increasing sequence', () => {
  const pages = [1, 2, 3, 4].map((pageNumber) =>
    pageWithNumber(pageNumber, pageNumber === 3 ? '9' : `${pageNumber}`)
  )
  const match = detectPageNumberStyle(pages)

  assert.equal(match, undefined)
})

test('does not match numbers that live in the page body rather than the margin', () => {
  const pages = [1, 2, 3].map((pageNumber) => ({
    pageNumber,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    lines: [
      {
        text: `${pageNumber}`,
        bbox: { x: 280, y: 400, width: 40, height: 10, coordinateSpace: 'pdf-points' as const }
      }
    ]
  }))
  const match = detectPageNumberStyle(pages)

  assert.equal(match, undefined)
})

test('requires coverage across most pages before matching', () => {
  const pages: PageNumberScanPage[] = [
    pageWithNumber(1, '1'),
    { pageNumber: 2, width: PAGE_WIDTH, height: PAGE_HEIGHT, lines: [] },
    { pageNumber: 3, width: PAGE_WIDTH, height: PAGE_HEIGHT, lines: [] },
    pageWithNumber(4, '4')
  ]
  const match = detectPageNumberStyle(pages)

  assert.equal(match, undefined)
})
