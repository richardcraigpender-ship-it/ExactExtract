import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry, ProjectPage } from '../../../shared/contracts'
import {
  applyGeometryEdit,
  applyHighlightGeometry,
  describeHighlightScope,
  measureHighlight,
  resolveHighlightTargets
} from './highlightGeometry'

const pages: ProjectPage[] = [
  { documentId: 'doc-1', pageNumber: 1, width: 200, height: 400, rotation: 0, kind: 'text' }
]

function entry(
  id: string,
  overrides: Partial<ProjectEntry> = {},
  regions: ProjectEntry['regions'] = [
    {
      documentId: 'doc-1',
      pageNumber: 1,
      bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1, coordinateSpace: 'normalized' }
    }
  ]
): ProjectEntry {
  return {
    id,
    rawText: id,
    normalizedText: id,
    source: 'parser',
    status: 'maybe',
    confidence: 1,
    regions,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

// HT-A-006
test('clamps absolute geometry edits inside the page bounds', () => {
  const rect = { x: 0.1, y: 0.2, width: 0.3, height: 0.1 }

  assert.deepEqual(applyGeometryEdit(rect, { field: 'x', mode: 'absolute', value: 5 }), {
    x: 0.7,
    y: 0.2,
    width: 0.3,
    height: 0.1
  })
  assert.deepEqual(applyGeometryEdit(rect, { field: 'x', mode: 'absolute', value: -5 }), {
    x: 0,
    y: 0.2,
    width: 0.3,
    height: 0.1
  })
})

// HT-A-006
test('keeps resized rectangles on the page and enforces a minimum size', () => {
  const rect = { x: 0.8, y: 0.8, width: 0.1, height: 0.1 }

  const widened = applyGeometryEdit(rect, { field: 'width', mode: 'absolute', value: 0.9 })
  assert.ok(widened.x + widened.width <= 1 + Number.EPSILON)

  const collapsed = applyGeometryEdit(rect, { field: 'height', mode: 'absolute', value: 0 })
  assert.equal(collapsed.height, 0.01)
})

// HT-A-005
test('applies delta edits relative to the current value', () => {
  const result = applyGeometryEdit(
    { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
    { field: 'y', mode: 'delta', value: 0.05 }
  )

  assert.ok(Math.abs(result.y - 0.25) < 1e-9)
  assert.equal(result.x, 0.1)
  assert.equal(result.width, 0.3)
  assert.equal(result.height, 0.1)
})

// HT-A-004
test('resolves targets for entry, selected, and all scopes', () => {
  const entries = [entry('a'), entry('b'), entry('c')]

  assert.deepEqual(resolveHighlightTargets(entries, { scope: 'entry', selectedEntryId: 'b' }), [
    { entryId: 'b', regionIndex: 0 }
  ])
  assert.deepEqual(
    resolveHighlightTargets(entries, {
      scope: 'selected',
      selectedEntryIds: new Set(['a', 'c'])
    }),
    [
      { entryId: 'a', regionIndex: 0 },
      { entryId: 'c', regionIndex: 0 }
    ]
  )
  assert.equal(resolveHighlightTargets(entries, { scope: 'all' }).length, 3)
})

test('excludes regions without geometry or on another document or page', () => {
  const entries = [
    entry('no-bbox', {}, [{ documentId: 'doc-1', pageNumber: 1 }]),
    entry('other-doc', {}, [
      {
        documentId: 'doc-2',
        pageNumber: 1,
        bbox: { x: 0, y: 0, width: 0.1, height: 0.1, coordinateSpace: 'normalized' }
      }
    ]),
    entry('other-page', {}, [
      {
        documentId: 'doc-1',
        pageNumber: 9,
        bbox: { x: 0, y: 0, width: 0.1, height: 0.1, coordinateSpace: 'normalized' }
      }
    ]),
    entry('match')
  ]

  assert.deepEqual(
    resolveHighlightTargets(entries, { scope: 'all', documentId: 'doc-1', pageNumber: 1 }),
    [{ entryId: 'match', regionIndex: 0 }]
  )
})

// HT-A-004
test('updates only targeted regions and reports the affected counts', () => {
  const entries = [entry('a'), entry('b')]
  const result = applyHighlightGeometry(
    entries,
    [{ entryId: 'a', regionIndex: 0 }],
    { field: 'x', mode: 'absolute', value: 0.5 },
    pages,
    '2026-02-02T00:00:00.000Z'
  )

  assert.equal(result.changedRegionCount, 1)
  assert.equal(result.changedEntryCount, 1)
  assert.equal(result.entries[0]?.regions[0]?.bbox?.x, 0.5)
  assert.equal(result.entries[0]?.updatedAt, '2026-02-02T00:00:00.000Z')
  // Untouched entries keep their original identity so React can skip re-rendering them.
  assert.equal(result.entries[1], entries[1])
})

test('round-trips pdf-points geometry through the normalized edit space', () => {
  const entries = [
    entry('points', {}, [
      {
        documentId: 'doc-1',
        pageNumber: 1,
        bbox: { x: 20, y: 40, width: 60, height: 80, coordinateSpace: 'pdf-points' }
      }
    ])
  ]

  const result = applyHighlightGeometry(
    entries,
    [{ entryId: 'points', regionIndex: 0 }],
    { field: 'width', mode: 'delta', value: 0 },
    pages,
    '2026-02-02T00:00:00.000Z'
  )

  const bbox = result.entries[0]?.regions[0]?.bbox
  assert.equal(bbox?.coordinateSpace, 'pdf-points')
  assert.ok(Math.abs((bbox?.x ?? 0) - 20) < 1e-9)
  assert.ok(Math.abs((bbox?.y ?? 0) - 40) < 1e-9)
  assert.ok(Math.abs((bbox?.width ?? 0) - 60) < 1e-9)
  assert.ok(Math.abs((bbox?.height ?? 0) - 80) < 1e-9)
})

test('returns the original entries when no targets match', () => {
  const entries = [entry('a')]
  const result = applyHighlightGeometry(
    entries,
    [],
    { field: 'x', mode: 'absolute', value: 0.5 },
    pages,
    '2026-02-02T00:00:00.000Z'
  )

  assert.equal(result.changedRegionCount, 0)
  assert.equal(result.entries[0], entries[0])
})

// HT-C-005
test('describes the affected highlight count', () => {
  assert.equal(describeHighlightScope(0), 'No highlights match this scope.')
  assert.equal(describeHighlightScope(1), '1 highlight will be updated.')
  assert.equal(describeHighlightScope(4), '4 highlights will be updated.')
})

// HT-A-007
test('sets geometry in PDF points using the bottom-up page space', () => {
  // Page is 200x400. A box at normalized y=0.2 height=0.1 sits at pdf y = (1-0.2-0.1)*400 = 280.
  const result = applyGeometryEdit(
    { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
    { field: 'y', mode: 'absolute', value: 100, unit: 'points' },
    { width: 200, height: 400 }
  )

  // pdf y=100 with height 40 means the top edge is at 140 from the bottom, so
  // normalized (top-down) y = 1 - 140/400 = 0.65.
  assert.ok(Math.abs(result.y - 0.65) < 1e-9)
  assert.ok(Math.abs(result.x - 0.1) < 1e-9)
  assert.ok(Math.abs(result.height - 0.1) < 1e-9)
})

// HT-A-008
test('sets width in PDF points and converts back to a page fraction', () => {
  const result = applyGeometryEdit(
    { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
    { field: 'width', mode: 'absolute', value: 50, unit: 'points' },
    { width: 200, height: 400 }
  )

  assert.ok(Math.abs(result.width - 0.25) < 1e-9)
})

// HT-A-009
test('applies point deltas and still clamps to the page', () => {
  const nudged = applyGeometryEdit(
    { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
    { field: 'x', mode: 'delta', value: 20, unit: 'points' },
    { width: 200, height: 400 }
  )
  assert.ok(Math.abs(nudged.x - 0.2) < 1e-9)

  const clamped = applyGeometryEdit(
    { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
    { field: 'x', mode: 'absolute', value: 9999, unit: 'points' },
    { width: 200, height: 400 }
  )
  assert.ok(Math.abs(clamped.x - 0.7) < 1e-9)
})

// HT-A-010
test('leaves geometry untouched when a point edit has no page size', () => {
  assert.deepEqual(
    applyGeometryEdit(
      { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
      { field: 'x', mode: 'absolute', value: 50, unit: 'points' },
      undefined
    ),
    { x: 0.1, y: 0.2, width: 0.3, height: 0.1 }
  )
})

// HT-A-011
test('applies point edits through applyHighlightGeometry for pdf-points regions', () => {
  const entries = [
    entry('a', {}, [
      {
        documentId: 'doc-1',
        pageNumber: 1,
        bbox: { x: 20, y: 280, width: 60, height: 40, coordinateSpace: 'pdf-points' }
      }
    ])
  ]

  const result = applyHighlightGeometry(
    entries,
    [{ entryId: 'a', regionIndex: 0 }],
    { field: 'x', mode: 'absolute', value: 50, unit: 'points' },
    pages,
    '2026-02-02T00:00:00.000Z'
  )

  const bbox = result.entries[0].regions[0].bbox
  assert.equal(result.changedRegionCount, 1)
  assert.ok(bbox && Math.abs(bbox.x - 50) < 1e-9)
  assert.ok(bbox && Math.abs(bbox.y - 280) < 1e-9)
})

// HT-A-012
test('measures a highlight in both percent and points', () => {
  const entries = [entry('a')]
  const measured = measureHighlight(entries, { entryId: 'a', regionIndex: 0 }, pages)

  assert.ok(measured)
  assert.ok(Math.abs(measured.percent.x - 10) < 1e-9)
  assert.ok(Math.abs(measured.percent.y - 20) < 1e-9)
  // normalized y=0.2 height=0.1 on a 400pt page -> pdf y = (1-0.3)*400 = 280
  assert.ok(measured.points && Math.abs(measured.points.y - 280) < 1e-9)
  assert.ok(measured.points && Math.abs(measured.points.width - 60) < 1e-9)
})

// HT-A-013
test('returns no measurement for a missing target or region', () => {
  const entries = [entry('a')]
  assert.equal(measureHighlight(entries, undefined, pages), null)
  assert.equal(measureHighlight(entries, { entryId: 'nope', regionIndex: 0 }, pages), null)
  assert.equal(measureHighlight(entries, { entryId: 'a', regionIndex: 5 }, pages), null)
})

// HT-A-014
test('resolves targets for the keep scope by review status', () => {
  const entries = [
    entry('a', { status: 'keep' }),
    entry('b', { status: 'maybe' }),
    entry('c', { status: 'keep' }),
    entry('d', { status: 'exclude' })
  ]

  assert.deepEqual(resolveHighlightTargets(entries, { scope: 'keep' }), [
    { entryId: 'a', regionIndex: 0 },
    { entryId: 'c', regionIndex: 0 }
  ])
})

// HT-A-015
test('keep scope ignores the checked selection and the selected entry', () => {
  const entries = [entry('a', { status: 'keep' }), entry('b', { status: 'maybe' })]

  assert.deepEqual(
    resolveHighlightTargets(entries, {
      scope: 'keep',
      selectedEntryId: 'b',
      selectedEntryIds: new Set(['b'])
    }),
    [{ entryId: 'a', regionIndex: 0 }]
  )
})

// HT-A-016
test('keep scope returns nothing when no entries are marked keep', () => {
  const entries = [entry('a', { status: 'maybe' }), entry('b', { status: 'exclude' })]
  assert.deepEqual(resolveHighlightTargets(entries, { scope: 'keep' }), [])
})

// HT-A-017
test('keep scope can still be narrowed to one page when a page is given', () => {
  const entries = [
    entry('a', { status: 'keep' }, [
      {
        documentId: 'doc-1',
        pageNumber: 2,
        bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1, coordinateSpace: 'normalized' }
      }
    ]),
    entry('b', { status: 'keep' })
  ]

  assert.deepEqual(resolveHighlightTargets(entries, { scope: 'keep', pageNumber: 1 }), [
    { entryId: 'b', regionIndex: 0 }
  ])
})
