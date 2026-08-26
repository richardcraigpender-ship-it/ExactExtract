import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import {
  detectBrokenRowsAcrossPages,
  detectDuplicateEntries,
  detectReviewIssues
} from './heuristics'

function entry(
  id: string,
  text: string,
  pageNumber: number,
  options: { documentId?: string; tags?: string[]; y?: number } = {}
): ProjectEntry {
  return {
    id,
    rawText: text,
    normalizedText: text,
    source: 'parser',
    status: 'maybe',
    confidence: 1,
    regions: [
      {
        documentId: options.documentId ?? 'document-1',
        pageNumber,
        bbox: { x: 10, y: options.y ?? 10, width: 40, height: 10, coordinateSpace: 'pdf-points' }
      }
    ],
    tags: options.tags ?? [],
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z'
  }
}

test('groups normalized duplicates within the same document deterministically', () => {
  const issues = detectDuplicateEntries([
    entry('b', ' Total   Due ', 2),
    entry('a', 'total due', 1),
    entry('other-document', 'total due', 1, { documentId: 'document-2' })
  ])

  assert.equal(issues.length, 1)
  assert.deepEqual(issues[0]?.entryIds, ['a', 'b'])
  assert.deepEqual(issues[0]?.pageNumbers, [1, 2])
})

test('detects likely continuation across adjacent pages', () => {
  const issues = detectBrokenRowsAcrossPages([
    entry('previous', 'Consulting services', 1),
    entry('next', 'continued through December', 2)
  ])

  assert.equal(issues.length, 1)
  assert.equal(issues[0]?.code, 'broken-row-across-pages')
  assert.deepEqual(issues[0]?.entryIds, ['previous', 'next'])
})

test('does not flag complete sentences or non-adjacent pages', () => {
  assert.equal(
    detectBrokenRowsAcrossPages([
      entry('complete', 'Complete sentence.', 1),
      entry('next', 'continued text', 2),
      entry('gap', 'lowercase continuation', 4)
    ]).length,
    0
  )
})

test('detects adjacent table rows even when the next row begins uppercase', () => {
  const issues = detectReviewIssues([
    entry('row-1', 'Service description', 1, { tags: ['table-row'] }),
    entry('row-2', 'Additional charge', 2, { tags: ['table-row'] })
  ])
  assert.ok(issues.some((issue) => issue.code === 'broken-row-across-pages'))
})

test('uses page geometry and expected row height for cross-page candidates', () => {
  const issues = detectBrokenRowsAcrossPages(
    [entry('bottom', 'Payment from PENDER', 1, { y: 4 }), entry('top', 'RC £30.00', 2, { y: 770 })],
    {
      expectedRowHeight: 12,
      pages: [
        {
          documentId: 'document-1',
          pageNumber: 1,
          width: 612,
          height: 792,
          rotation: 0,
          kind: 'text'
        },
        {
          documentId: 'document-1',
          pageNumber: 2,
          width: 612,
          height: 792,
          rotation: 0,
          kind: 'text'
        }
      ]
    }
  )

  assert.equal(issues.length, 1)
  assert.deepEqual(issues[0]?.pageNumbers, [1, 2])
})
