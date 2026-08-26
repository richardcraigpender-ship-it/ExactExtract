import assert from 'node:assert/strict'
import test from 'node:test'

import type { KeptEntryPlacement } from '../../../shared/keptEntriesLayout'
import { updatePlacementFromPointerDelta } from './useCanvasDrag'

const placement: KeptEntryPlacement = {
  id: 'placement-1',
  text: 'Entry',
  x: 40,
  y: 50,
  width: 100,
  height: 30,
  rotation: 0,
  fontRef: { kind: 'standard-14', family: 'Helvetica' },
  fontSize: 11,
  color: '#000000'
}

test('moves placements in PDF points and clamps them to the page', () => {
  assert.deepEqual(
    updatePlacementFromPointerDelta(
      placement,
      'move',
      { x: 20, y: -100 },
      { width: 200, height: 200 }
    ),
    { ...placement, x: 60, y: 0 }
  )
  assert.deepEqual(
    updatePlacementFromPointerDelta(
      placement,
      'move',
      { x: 500, y: 500 },
      { width: 200, height: 200 }
    ),
    { ...placement, x: 100, y: 170 }
  )
})

test('resizes placements within minimum and page bounds', () => {
  assert.deepEqual(
    updatePlacementFromPointerDelta(
      placement,
      'resize',
      { x: -500, y: -500 },
      { width: 200, height: 200 }
    ),
    { ...placement, width: 24, height: 16 }
  )
  assert.deepEqual(
    updatePlacementFromPointerDelta(
      placement,
      'resize',
      { x: 500, y: 500 },
      { width: 200, height: 200 }
    ),
    { ...placement, width: 160, height: 150 }
  )
})
