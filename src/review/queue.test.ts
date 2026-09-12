import assert from 'node:assert/strict'
import test from 'node:test'

import { buildReviewQueue, DEFAULT_REVIEW_QUEUE_CONFIDENCE_THRESHOLD } from './queue'
import type { ProjectEntry } from '../shared/contracts'

function entry(id: string, overrides: Partial<ProjectEntry> = {}): ProjectEntry {
  return {
    id,
    rawText: id,
    normalizedText: id,
    source: 'parser',
    status: 'keep',
    confidence: 0.95,
    regions: [],
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

test('uses the shared confidence threshold and stable priority order', () => {
  const queue = buildReviewQueue([
    entry('maybe', { status: 'maybe' }),
    entry('ocr', { source: 'ocr' }),
    entry('low', { confidence: DEFAULT_REVIEW_QUEUE_CONFIDENCE_THRESHOLD - 0.01 })
  ])

  assert.deepEqual(queue.map((item) => item.entryId), ['low', 'ocr', 'maybe'])
  assert.deepEqual(queue[0]?.reasons.map((item) => item.code), ['low-confidence'])
})

test('combines review, analysis, and mapping reasons without duplicate queue items', () => {
  const queue = buildReviewQueue(
    [entry('a', { confidence: 0.5 }), entry('b'), entry('c')],
    {
      reviewIssues: [
        {
          id: 'duplicate:a|b',
          code: 'duplicate-entry',
          severity: 'warning',
          entryIds: ['a', 'b'],
          documentId: 'doc',
          pageNumbers: [1],
          evidence: 'same text'
        }
      ],
      analysisIssueEntryIds: new Set(['a']),
      unmappedEntryIds: new Set(['c'])
    }
  )

  assert.equal(queue.length, 3)
  assert.deepEqual(queue.find((item) => item.entryId === 'a')?.reasons.map((item) => item.code), [
    'low-confidence',
    'duplicate-candidate',
    'review-warning'
  ])
  assert.deepEqual(queue.find((item) => item.entryId === 'b')?.reasons.map((item) => item.code), [
    'duplicate-candidate'
  ])
  assert.deepEqual(queue.find((item) => item.entryId === 'c')?.reasons.map((item) => item.code), [
    'unmapped-financial-row'
  ])
})

test('clamps an invalid confidence threshold', () => {
  const queue = buildReviewQueue([entry('a', { confidence: 0.1 })], { confidenceThreshold: -1 })
  assert.equal(queue[0], undefined)
})
