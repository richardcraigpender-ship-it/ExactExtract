import assert from 'node:assert/strict'
import test from 'node:test'

import {
  describeViewerHighlight,
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
