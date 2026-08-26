import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import {
  applyPageForwardCarryover,
  buildCompactSourceRows,
  prepareCompactSourceRows
} from './compact'

function row(id: string, status: ProjectEntry['status'], y: number, height = 12): ProjectEntry {
  return {
    id,
    rawText: id,
    normalizedText: id,
    source: 'parser',
    status,
    confidence: 1,
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x: 40, y, width: 200, height, coordinateSpace: 'pdf-points' }
      }
    ],
    tags: [],
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z'
  }
}

const pageHeights = new Map([['document-1:1', 500]])

function rowOnPage(
  id: string,
  status: ProjectEntry['status'],
  y: number,
  pageNumber: number,
  height = 12
): ProjectEntry {
  return {
    id,
    rawText: id,
    normalizedText: id,
    source: 'parser',
    status,
    confidence: 1,
    regions: [
      {
        documentId: 'document-1',
        pageNumber,
        bbox: { x: 40, y, width: 200, height, coordinateSpace: 'pdf-points' }
      }
    ],
    tags: [],
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z'
  }
}

test('prepares a stable compact source row contract before reflow', () => {
  const rows = prepareCompactSourceRows(
    [row('excluded', 'exclude', 420), row('kept', 'keep', 390)],
    pageHeights
  )

  assert.deepEqual(
    rows.map(({ entry, sourceY, isExcluded }) => ({ id: entry.id, sourceY, isExcluded })),
    [
      { id: 'excluded', sourceY: 420, isExcluded: true },
      { id: 'kept', sourceY: 390, isExcluded: false }
    ]
  )
})

test('accepts a custom isRemoved predicate so maybe rows can be treated as removed too', () => {
  const rows = prepareCompactSourceRows(
    [row('excluded', 'exclude', 420), row('maybe', 'maybe', 405), row('kept', 'keep', 390)],
    pageHeights,
    (entry) => entry.status !== 'keep'
  )

  assert.deepEqual(
    rows.map(({ entry, isExcluded }) => ({ id: entry.id, isExcluded })),
    [
      { id: 'excluded', isExcluded: true },
      { id: 'maybe', isExcluded: true },
      { id: 'kept', isExcluded: false }
    ]
  )
})

test('buildCompactSourceRows threads the isRemoved predicate through to compaction', () => {
  const rows = buildCompactSourceRows(
    [row('excluded', 'exclude', 420), row('maybe', 'maybe', 405), row('kept', 'keep', 390)],
    18,
    pageHeights,
    undefined,
    (entry) => entry.status !== 'keep'
  )

  assert.deepEqual(
    rows.map((entry) => entry.entry.id),
    ['kept']
  )
})

test('removes excluded rows and shifts later rows into the freed slot', () => {
  const rows = buildCompactSourceRows(
    [row('excluded', 'exclude', 420), row('kept', 'keep', 390)],
    18,
    pageHeights
  )

  assert.deepEqual(
    rows.map(({ entry, sourceY, targetY }) => ({ id: entry.id, sourceY, targetY })),
    [{ id: 'kept', sourceY: 390, targetY: 402 }]
  )
})

test("shifts rows by each excluded row's own height, not a flat nominal row height", () => {
  // Real extracted rows have heterogeneous heights. A flat per-exclusion shift (the previous
  // `rowHeight` constant) drifts remaining rows out of position whenever actual heights differ
  // from that constant, compounding across many exclusions.
  const rows = buildCompactSourceRows(
    [
      row('excluded-short', 'exclude', 470, 8), // frees only 8pt, not the flat 18pt constant
      row('excluded-tall', 'exclude', 440, 26), // frees 26pt, more than the flat constant
      row('kept', 'keep', 390, 12)
    ],
    18,
    pageHeights
  )

  assert.deepEqual(
    rows.map(({ entry, targetY }) => ({ id: entry.id, targetY })),
    // Correct cumulative freed space is 8 + 26 = 34, so the kept row moves from 390 to 424 -
    // not 390 + 2 * 18 = 426, which is what the flat-constant bug would have produced.
    [{ id: 'kept', targetY: 424 }]
  )
})

test('never places compacted rows above the highest point any original entry reached on the page', () => {
  // Simulates a page with an untracked header/logo above the topmost real entry: nothing in the
  // row model represents that header, so the only safe invariant is that compacted rows must
  // never rise above where a real (kept or excluded) entry already existed in the source layout.
  const heights = new Map([['document-1:1', 792]])
  const topEntry = row('top', 'keep', 700, 14) // topmost known real content on the page
  const manySmallExclusions = Array.from({ length: 40 }, (_, index) =>
    row(`excluded-${index}`, 'exclude', 690 - index * 10, 6)
  )
  // This row sits in a column that never horizontally overlaps the topmost row, so collision
  // detection against placed rows alone would not stop it from drifting arbitrarily high.
  const drifting = row('drifting', 'keep', 60, 14)
  drifting.regions[0]!.bbox = {
    x: 300,
    y: 60,
    width: 60,
    height: 14,
    coordinateSpace: 'pdf-points'
  }

  const rows = buildCompactSourceRows([topEntry, ...manySmallExclusions, drifting], 18, heights)

  const driftingRow = rows.find((item) => item.entry.id === 'drifting')
  assert.ok(driftingRow)
  assert.ok(
    driftingRow.targetY + driftingRow.height <=
      topEntry.regions[0]!.bbox!.y + topEntry.regions[0]!.bbox!.height,
    'a compacted row must never rise above the highest point real content originally reached'
  )
})

test('orders rows deterministically and prevents retained rows from overlapping', () => {
  const rows = buildCompactSourceRows(
    [row('lower', 'keep', 390, 16), row('upper', 'keep', 400, 16)],
    18,
    pageHeights
  )

  assert.deepEqual(
    rows.map((item) => item.entry.id),
    ['upper', 'lower']
  )
  assert.equal(rows[1]!.targetY + rows[1]!.height, rows[0]!.targetY)
})

test('keeps horizontally disjoint columns aligned on the same baseline', () => {
  const left = row('left', 'keep', 400, 16)
  left.regions[0]!.bbox = {
    x: 40,
    y: 400,
    width: 120,
    height: 16,
    coordinateSpace: 'pdf-points'
  }
  const right = row('right', 'keep', 400, 16)
  right.regions[0]!.bbox = {
    x: 220,
    y: 400,
    width: 120,
    height: 16,
    coordinateSpace: 'pdf-points'
  }

  const rows = buildCompactSourceRows([right, left], 18, pageHeights)

  assert.deepEqual(
    rows.map(({ entry, targetY }) => ({ id: entry.id, targetY })),
    [
      { id: 'left', targetY: 400 },
      { id: 'right', targetY: 400 }
    ]
  )
})

test('returns document and page groups deterministically regardless of entry order', () => {
  const documentTwo = rowOnPage('document-two', 'keep', 300, 1)
  documentTwo.regions[0]!.documentId = 'document-2'
  const pageTwo = rowOnPage('page-two', 'keep', 300, 2)
  const pageOne = rowOnPage('page-one', 'keep', 300, 1)
  const heights = new Map([
    ['document-1:1', 500],
    ['document-1:2', 500],
    ['document-2:1', 500]
  ])

  const rows = buildCompactSourceRows([documentTwo, pageTwo, pageOne], 18, heights)

  assert.deepEqual(
    rows.map((item) => item.entry.id),
    ['page-one', 'page-two', 'document-two']
  )
})

test('unions same-page regions and keeps target rows inside the page', () => {
  const entry = row('multi-region', 'keep', 490, 20)
  entry.regions.push({
    documentId: 'document-1',
    pageNumber: 1,
    bbox: { x: 260, y: 492, width: 80, height: 8, coordinateSpace: 'pdf-points' }
  })

  const [compacted] = buildCompactSourceRows([entry], 18, pageHeights)

  assert.deepEqual(
    compacted && {
      x: compacted.x,
      width: compacted.width,
      height: compacted.height,
      targetY: compacted.targetY
    },
    { x: 40, width: 300, height: 20, targetY: 480 }
  )
})

test('detects continuation rows at the top of a page and pulls them forward', () => {
  const pageHeights = new Map([
    ['document-1:1', 500],
    ['document-1:2', 500]
  ])
  const rows = buildCompactSourceRows(
    [row('page1-bottom', 'keep', 100, 12), rowOnPage('page2-top-continuation', 'keep', 480, 2, 12)],
    18,
    pageHeights
  )

  // Apply carryover with high threshold to capture page-2 top rows
  const afterCarryover = applyPageForwardCarryover(rows, pageHeights, 100)

  // Verify the continuation row moved to page 1
  const carried = afterCarryover.find((r) => r.entry.id === 'page2-top-continuation')
  assert.ok(carried)
  assert.equal(carried.pageNumber, 1, 'Continuation row should move to previous page')
  assert.ok(carried.targetY < 500, 'Carried row should be below top-of-page margin')
})

test('does not carry over rows when they would not fit on previous page', () => {
  const pageHeights = new Map([
    ['document-1:1', 100],
    ['document-1:2', 500]
  ])
  const rows = buildCompactSourceRows(
    [row('page1-full', 'keep', 90, 92), rowOnPage('page2-top', 'keep', 480, 2, 12)],
    18,
    pageHeights
  )

  const afterCarryover = applyPageForwardCarryover(rows, pageHeights, 100)

  // Row should remain on page 2 because it doesn't fit on page 1
  const stayed = afterCarryover.find((r) => r.entry.id === 'page2-top')
  assert.ok(stayed)
  assert.equal(stayed.pageNumber, 2, 'Row should stay on page 2 when no space on page 1')
})

test('prevents carryover across different documents', () => {
  const pageHeights = new Map([
    ['document-1:1', 500],
    ['document-2:1', 500]
  ])
  const doc1Row = row('doc1', 'keep', 100, 12)
  const doc2Row = rowOnPage('doc2', 'keep', 480, 1, 12)
  doc2Row.regions[0]!.documentId = 'document-2'

  const rows = buildCompactSourceRows([doc1Row, doc2Row], 18, pageHeights)
  const afterCarryover = applyPageForwardCarryover(rows, pageHeights, 100)

  // doc2 should stay on document-2:1, not move to document-1:1
  const doc2After = afterCarryover.find((r) => r.entry.id === 'doc2')
  assert.ok(doc2After)
  assert.equal(doc2After.documentId, 'document-2')
})

test('does not stack two same-page continuation rows at the same carried position', () => {
  const pageHeights = new Map([
    ['document-1:1', 500],
    ['document-1:2', 500]
  ])
  const rows = buildCompactSourceRows(
    [
      row('page1-bottom', 'keep', 100, 12),
      rowOnPage('page2-top-a', 'keep', 480, 2, 12),
      rowOnPage('page2-top-b', 'keep', 460, 2, 12)
    ],
    18,
    pageHeights
  )

  const afterCarryover = applyPageForwardCarryover(rows, pageHeights, 100)

  const carriedA = afterCarryover.find((r) => r.entry.id === 'page2-top-a')
  const carriedB = afterCarryover.find((r) => r.entry.id === 'page2-top-b')
  assert.ok(carriedA && carriedB, 'both continuation candidates should be present exactly once')
  assert.equal(carriedA.pageNumber, 1)
  assert.equal(carriedB.pageNumber, 1)

  // Two rows carried onto the same previous page must not occupy the same vertical slot.
  assert.notEqual(
    carriedA.targetY,
    carriedB.targetY,
    'two carried rows must not share the same target position on the previous page'
  )
  const [lower, upper] = [carriedA, carriedB].sort((left, right) => left.targetY - right.targetY)
  assert.ok(
    upper.targetY >= lower.targetY + lower.height,
    'carried rows on the previous page must not overlap each other'
  )
})

test('does not duplicate or drop rows across a full carryover pass', () => {
  const pageHeights = new Map([
    ['document-1:1', 500],
    ['document-1:2', 500]
  ])
  const rows = buildCompactSourceRows(
    [
      row('page1-bottom', 'keep', 100, 12),
      rowOnPage('page2-top-a', 'keep', 480, 2, 12),
      rowOnPage('page2-top-b', 'keep', 460, 2, 12),
      rowOnPage('page2-middle', 'keep', 200, 2, 12)
    ],
    18,
    pageHeights
  )

  const afterCarryover = applyPageForwardCarryover(rows, pageHeights, 100)

  assert.equal(afterCarryover.length, rows.length, 'carryover must not create or drop rows')
  const ids = afterCarryover.map((r) => r.entry.id).sort()
  assert.deepEqual(ids, rows.map((r) => r.entry.id).sort())
})

test('closes multiple excluded slots without leaving compact-row gaps', () => {
  const rows = buildCompactSourceRows(
    [
      row('excluded-a', 'exclude', 450),
      row('kept-a', 'keep', 432),
      row('excluded-b', 'exclude', 414),
      row('kept-b', 'keep', 396)
    ],
    18,
    pageHeights
  )

  assert.deepEqual(
    rows.map(({ entry, targetY }) => ({ id: entry.id, targetY })),
    [
      { id: 'kept-a', targetY: 444 },
      { id: 'kept-b', targetY: 420 }
    ]
  )
})

test('reserves distinct ordered slots for three same-page continuation rows', () => {
  const heights = new Map([
    ['document-1:1', 500],
    ['document-1:2', 500]
  ])
  const rows = buildCompactSourceRows(
    [
      row('page1-bottom', 'keep', 120, 12),
      rowOnPage('page2-top-a', 'keep', 480, 2, 12),
      rowOnPage('page2-top-b', 'keep', 460, 2, 12),
      rowOnPage('page2-top-c', 'keep', 440, 2, 12)
    ],
    18,
    heights
  )

  const afterCarryover = applyPageForwardCarryover(rows, heights, 100)
  const carried = afterCarryover.filter((item) => item.entry.id.startsWith('page2-top'))

  assert.equal(carried.length, 3)
  assert.deepEqual(
    carried.map(({ entry, pageNumber, targetY }) => ({ id: entry.id, pageNumber, targetY })),
    [
      { id: 'page2-top-a', pageNumber: 1, targetY: 102 },
      { id: 'page2-top-b', pageNumber: 1, targetY: 84 },
      { id: 'page2-top-c', pageNumber: 1, targetY: 66 }
    ]
  )
})

test('chains carryover one page at a time while preserving source-region traceability', () => {
  const heights = new Map([
    ['document-1:1', 500],
    ['document-1:2', 500],
    ['document-1:3', 500]
  ])
  const rows = buildCompactSourceRows(
    [
      row('page1-anchor', 'keep', 100, 12),
      rowOnPage('page2-continuation', 'keep', 480, 2, 12),
      rowOnPage('page3-continuation', 'keep', 480, 3, 12)
    ],
    18,
    heights
  )

  const afterCarryover = applyPageForwardCarryover(rows, heights, 100)
  const page2 = afterCarryover.find((item) => item.entry.id === 'page2-continuation')
  const page3 = afterCarryover.find((item) => item.entry.id === 'page3-continuation')

  assert.ok(page2 && page3)
  assert.equal(page2.pageNumber, 1)
  assert.equal(page3.pageNumber, 2)
  assert.equal(page2.entry.regions[0]!.pageNumber, 2)
  assert.equal(page3.entry.regions[0]!.pageNumber, 3)
  assert.deepEqual(afterCarryover.map((item) => item.entry.id).sort(), [
    'page1-anchor',
    'page2-continuation',
    'page3-continuation'
  ])
})

test('handles multi-page carryover chains correctly', () => {
  const pageHeights = new Map([
    ['document-1:1', 500],
    ['document-1:2', 500],
    ['document-1:3', 500]
  ])
  const rows = buildCompactSourceRows(
    [
      row('p1', 'keep', 100, 12),
      rowOnPage('p2-top', 'keep', 480, 2, 12),
      rowOnPage('p3-top', 'keep', 480, 3, 12)
    ],
    18,
    pageHeights
  )

  const afterCarryover = applyPageForwardCarryover(rows, pageHeights, 100)

  // Both top rows should attempt carryover
  const p2Check = afterCarryover.find((r) => r.entry.id === 'p2-top')
  const p3Check = afterCarryover.find((r) => r.entry.id === 'p3-top')

  assert.ok(p2Check && p3Check, 'Both rows should be in result')
  // Order should remain correct (page 1 < 2 < 3 or carried back)
  assert.equal(
    afterCarryover.every((r) => r.pageNumber >= 1),
    true
  )
})
