import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import { buildEntryImageCrops } from './entryImages'

function entry(
  id: string,
  status: ProjectEntry['status'],
  date: string,
  x: number,
  y: number,
  width: number,
  height: number
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
        pageNumber: 1,
        bbox: { x, y, width, height, coordinateSpace: 'pdf-points' }
      }
    ],
    date,
    tags: [],
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z'
  }
}

test('uses the first kept entry size for every crop and numbers matching dates', () => {
  const crops = buildEntryImageCrops([
    entry('first', 'keep', '2026-03-26', 40, 400, 220, 18),
    entry('excluded', 'exclude', '2026-03-26', 40, 370, 900, 90),
    entry('second', 'keep', '2026-03-26', 60, 340, 180, 12),
    entry('third', 'keep', '2026-03-27', 80, 300, 200, 15)
  ])

  assert.deepEqual(
    crops.map(({ entryId, x, y, width, height, fileName }) => ({
      entryId,
      x,
      y,
      width,
      height,
      fileName
    })),
    [
      {
        entryId: 'first',
        x: 40,
        y: 400,
        width: 220,
        height: 18,
        fileName: '26 March 2026 (1).png'
      },
      {
        entryId: 'second',
        x: 60,
        y: 340,
        width: 220,
        height: 18,
        fileName: '26 March 2026 (2).png'
      },
      {
        entryId: 'third',
        x: 80,
        y: 300,
        width: 220,
        height: 18,
        fileName: '27 March 2026 (1).png'
      }
    ]
  )
})

test('rejects projects without a usable kept PDF region', () => {
  assert.throws(() => buildEntryImageCrops([]), /PDF-coordinate region/)
})
