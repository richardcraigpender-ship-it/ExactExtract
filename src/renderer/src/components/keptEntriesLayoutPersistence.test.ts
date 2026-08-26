import assert from 'node:assert/strict'
import test from 'node:test'
import type { ProjectState } from '../../../shared/contracts'
import type { KeptEntryPlacement } from '../../../shared/keptEntriesLayout'
import {
  nudgePlacement,
  restoreKeptEntriesLayout,
  updatePlacementPosition
} from './keptEntriesLayoutPersistence'

const placement: KeptEntryPlacement = {
  id: 'placement-1',
  text: 'Total',
  x: 10,
  y: 10,
  width: 100,
  height: 20,
  rotation: 0,
  fontRef: { kind: 'standard-14', family: 'Helvetica' as const },
  fontSize: 11,
  color: '#000000'
}

test('restores a defensive copy and falls back for missing layouts', () => {
  const empty = restoreKeptEntriesLayout({} as Pick<ProjectState, 'keptEntriesLayout'>)
  assert.equal(empty.version, 1)
  assert.equal(empty.placements.length, 0)

  const layout = restoreKeptEntriesLayout({
    keptEntriesLayout: {
      version: 1,
      pageSize: 'a4',
      orientation: 'landscape',
      placements: [placement]
    }
  })
  assert.equal(layout.pageSize, 'a4')
  assert.notEqual(layout.placements[0], placement)
})

test('moves and nudges placements within page bounds', () => {
  const moved = updatePlacementPosition(placement, 1000, 1000, 612, 792)
  assert.equal(moved.x, 512)
  assert.equal(moved.y, 772)
  assert.equal(nudgePlacement(placement, 'left', 612, 792).x, 8)
  assert.equal(nudgePlacement(placement, 'up', 612, 792).y, 8)
})
