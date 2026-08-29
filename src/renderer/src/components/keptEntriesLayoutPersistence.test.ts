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

test('restores version-2 image placements and page count', () => {
  const image = {
    id: 'kept-image-1',
    source: { kind: 'uploaded-png' as const, ref: `${'a'.repeat(64)}.png` },
    pageNumber: 2,
    x: 48,
    y: 60,
    width: 200,
    height: 100,
    fit: 'contain' as const
  }
  const layout = restoreKeptEntriesLayout({
    keptEntriesLayout: {
      version: 2,
      pageSize: 'letter',
      orientation: 'portrait',
      placements: [placement],
      images: [image],
      pageCount: 2
    }
  })

  assert.equal(layout.version, 2)
  assert.equal(layout.pageCount, 2)
  assert.deepEqual(layout.images, [image])
  assert.notEqual(layout.images?.[0], image)
})

test('moves and nudges placements within page bounds', () => {
  const moved = updatePlacementPosition(placement, 1000, 1000, 612, 792)
  assert.equal(moved.x, 512)
  assert.equal(moved.y, 772)
  assert.equal(nudgePlacement(placement, 'left', 612, 792).x, 8)
  assert.equal(nudgePlacement(placement, 'up', 612, 792).y, 8)
})
