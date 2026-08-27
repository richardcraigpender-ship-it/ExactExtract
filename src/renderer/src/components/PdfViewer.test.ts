import assert from 'node:assert/strict'
import test from 'node:test'

import {
  describeViewerHighlight,
  describeViewerHighlightCount,
  projectViewerRegion,
  unprojectViewerRegion,
  type ViewerRotation
} from './viewerAccessibility'

test('describes a selected PDF source region in page-relative terms', () => {
  assert.equal(
    describeViewerHighlight({ page: 3, x: 0.12, y: 0.34, width: 0.56, height: 0.08 }),
    'Selected source region on page 3: 12% from the left, 34% from the top, 56% wide, and 8% high.'
  )
})

test('projects source regions through viewer rotation and reverses edits', () => {
  const source = { x: 0.125, y: 0.25, width: 0.25, height: 0.125 }
  const expected = {
    0: source,
    90: { x: 0.625, y: 0.125, width: 0.125, height: 0.25 },
    180: { x: 0.625, y: 0.625, width: 0.25, height: 0.125 },
    270: { x: 0.25, y: 0.625, width: 0.125, height: 0.25 }
  } satisfies Record<ViewerRotation, typeof source>

  for (const rotation of [0, 90, 180, 270] as const) {
    const projected = projectViewerRegion(source, rotation)
    assert.deepEqual(projected, expected[rotation])
    assert.deepEqual(unprojectViewerRegion(projected, rotation), source)
  }
})

test('summarizes marked source regions on the displayed page by status', () => {
  const highlights = [
    { page: 2, x: 0.1, y: 0.1, width: 0.2, height: 0.1, status: 'keep' as const },
    { page: 2, x: 0.1, y: 0.3, width: 0.2, height: 0.1, status: 'keep' as const },
    { page: 2, x: 0.1, y: 0.5, width: 0.2, height: 0.1, status: 'exclude' as const },
    { page: 5, x: 0.1, y: 0.7, width: 0.2, height: 0.1, status: 'maybe' as const }
  ]

  assert.equal(
    describeViewerHighlightCount(highlights, 2),
    '3 marked source regions on page 2: 2 keep, 1 exclude.'
  )
})

test('treats regions without an explicit status as maybe and uses singular wording', () => {
  assert.equal(
    describeViewerHighlightCount([{ page: 1, x: 0, y: 0, width: 0.1, height: 0.1 }], 1),
    '1 marked source region on page 1: 1 maybe.'
  )
})

test('reports pages that have no marked source regions', () => {
  assert.equal(
    describeViewerHighlightCount([{ page: 4, x: 0, y: 0, width: 0.1, height: 0.1 }], 9),
    'No marked source regions on page 9.'
  )
})
