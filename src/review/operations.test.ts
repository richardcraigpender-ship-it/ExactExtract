import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import {
  findEntryDirectlyAbove,
  findPreferredSourceRegion,
  mergeReviewEntries,
  reconcileReviewSelection,
  splitReviewEntry
} from './operations'

function entry(id: string, text: string, pageNumber: number, y: number): ProjectEntry {
  return {
    id,
    rawText: text,
    normalizedText: text,
    source: 'parser',
    status: 'keep',
    confidence: id === 'a' ? 0.8 : 1,
    regions: [
      {
        documentId: 'document-1',
        pageNumber,
        bbox: { x: 40, y, width: 120, height: 12, coordinateSpace: 'pdf-points' }
      }
    ],
    tags: [id === 'a' ? 'first' : 'second', 'shared'],
    createdAt: id === 'a' ? '2026-08-15T10:00:00.000Z' : '2026-08-15T11:00:00.000Z',
    updatedAt: id === 'a' ? '2026-08-15T12:00:00.000Z' : '2026-08-15T13:00:00.000Z'
  }
}

test('merges entries deterministically while preserving review data and traceability', () => {
  const first = entry('a', 'First', 1, 700)
  const second = entry('b', 'Second', 2, 700)
  const merged = mergeReviewEntries([second, first])

  assert.equal(merged.id, 'review-merge:a|b')
  assert.equal(merged.normalizedText, 'First\nSecond')
  assert.equal(merged.status, 'keep')
  assert.equal(merged.confidence, 0.9)
  assert.equal(merged.createdAt, first.createdAt)
  assert.equal(merged.updatedAt, second.updatedAt)
  assert.deepEqual(merged.tags, ['first', 'second', 'shared'])
  assert.deepEqual(
    merged.regions.map((region) => region.pageNumber),
    [1, 2]
  )
})

test('prefers the merged source fragment on the page currently being viewed', () => {
  const merged = mergeReviewEntries([entry('a', 'First', 1, 700), entry('b', 'Second', 2, 700)])

  assert.equal(findPreferredSourceRegion(merged, 'document-1', 2)?.pageNumber, 2)
  assert.equal(findPreferredSourceRegion(merged, 'document-1', 3)?.pageNumber, 1)
})

test('rejects merges that would discard conflicting review status', () => {
  const first = entry('a', 'First', 1, 700)
  const second = { ...entry('b', 'Second', 1, 680), status: 'exclude' as const }
  assert.throws(() => mergeReviewEntries([first, second]), /different review statuses/)
})

test('splits entries with deterministic IDs and complete copied traceability', () => {
  const source = entry('a', 'Alpha; Beta', 1, 700)
  const split = splitReviewEntry(source, ['Alpha', 'Beta'])

  assert.match(split[0]!.id, /^a:split:1:[0-9a-f]{8}$/)
  assert.deepEqual(
    split.map((item) => item.normalizedText),
    ['Alpha', 'Beta']
  )
  assert.ok(split.every((item) => item.status === source.status))
  assert.ok(split.every((item) => item.createdAt === source.createdAt))
  assert.ok(split.every((item) => item.regions.length === source.regions.length))

  split[0]!.tags.push('changed')
  if (split[0]!.regions[0]?.bbox) split[0]!.regions[0].bbox.x = 999
  assert.deepEqual(source.tags, ['first', 'shared'])
  assert.equal(source.regions[0]?.bbox?.x, 40)
})

test('rejects empty and duplicate split parts', () => {
  const source = entry('a', 'Alpha; Beta', 1, 700)
  assert.throws(() => splitReviewEntry(source, ['Alpha']), /At least two/)
  assert.throws(() => splitReviewEntry(source, ['Alpha', ' Alpha ']), /unique/)
  assert.throws(() => splitReviewEntry(source, ['Alpha', 'alpha']), /unique/)
})

test('reconciles selection when undo removes merged or split IDs', () => {
  const entries = [entry('a', 'Alpha', 1, 700), entry('b', 'Beta', 1, 680)]
  const reconciled = reconcileReviewSelection(
    entries,
    new Set(['review-merge:a|b', 'b']),
    'review-merge:a|b'
  )

  assert.deepEqual([...reconciled.selectedIds], ['b'])
  assert.equal(reconciled.primaryId, 'b')
})

test('finds the physically closest pdf-points row above, ignoring list order', () => {
  const top = entry('a', 'Top', 1, 700)
  const middle = entry('b', 'Middle', 1, 680)
  const bottom = entry('c', 'Bottom', 1, 660)
  const entries = [bottom, top, middle]

  assert.equal(findEntryDirectlyAbove(middle, entries)?.id, 'a')
  assert.equal(findEntryDirectlyAbove(bottom, entries)?.id, 'b')
  assert.equal(findEntryDirectlyAbove(top, entries), undefined)
})

test('does not match rows on a different page or document', () => {
  const row = entry('a', 'Row', 2, 700)
  const otherPage = entry('b', 'Other page', 1, 750)
  const otherDocument: ProjectEntry = {
    ...entry('c', 'Other document', 2, 750),
    regions: [
      {
        documentId: 'document-2',
        pageNumber: 2,
        bbox: { x: 40, y: 750, width: 120, height: 12, coordinateSpace: 'pdf-points' }
      }
    ]
  }

  assert.equal(findEntryDirectlyAbove(row, [otherPage, otherDocument]), undefined)
})

test('treats normalized coordinates as top-down when finding the row above', () => {
  const upper: ProjectEntry = {
    ...entry('a', 'Upper', 1, 0),
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x: 0.1, y: 0.2, width: 0.5, height: 0.05, coordinateSpace: 'normalized' }
      }
    ]
  }
  const lower: ProjectEntry = {
    ...entry('b', 'Lower', 1, 0),
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x: 0.1, y: 0.4, width: 0.5, height: 0.05, coordinateSpace: 'normalized' }
      }
    ]
  }

  assert.equal(findEntryDirectlyAbove(lower, [upper, lower])?.id, 'a')
  assert.equal(findEntryDirectlyAbove(upper, [upper, lower]), undefined)
})
