import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts.ts'
import { projectEntriesToAnalysis } from './adapter.ts'
import { inferColumnRole } from './roles.ts'
import { createAnalysisSnapshot } from './snapshot.ts'

function entry(id: string, status: ProjectEntry['status'], numericValue: number): ProjectEntry {
  const timestamp = '2026-08-16T00:00:00.000Z'
  return {
    id,
    rawText: String(numericValue),
    normalizedText: String(numericValue),
    source: 'parser',
    status,
    confidence: 0.9,
    regions: [{ documentId: 'doc', pageNumber: 1 }],
    tags: [],
    numericValue,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

test('adapts frozen ProjectEntry values without mutation', () => {
  const source = [entry('maybe', 'maybe', 100), entry('keep', 'keep', 10)]
  const adapted = projectEntriesToAnalysis(source)
  assert.deepEqual(
    adapted.map((item) => item.id),
    ['keep', 'maybe']
  )
  assert.equal(adapted[1]?.uncertain, true)
  assert.equal(source[0]?.tags.length, 0)
})

test('infers ranked roles and preserves explicit assignments', () => {
  assert.equal(
    inferColumnRole({ key: 'amount', header: 'Total Amount', values: ['$10', '$20'] }).selectedRole,
    'amount'
  )
  assert.equal(
    inferColumnRole({ key: 'rate', header: 'Rate %', values: ['10%', '20%'] }).selectedRole,
    'percent'
  )
  const explicit = inferColumnRole({
    key: 'code',
    header: 'Code',
    values: [1, 2],
    explicitRole: 'label'
  })
  assert.equal(explicit.selectedRole, 'label')
  assert.equal(explicit.explicit, true)
})

test('creates a deterministic JSON-safe kept-only snapshot', () => {
  const adapted = projectEntriesToAnalysis([
    entry('exclude', 'exclude', 1000),
    entry('keep-b', 'keep', 20),
    entry('maybe', 'maybe', 500),
    entry('keep-a', 'keep', 10)
  ])
  const snapshot = createAnalysisSnapshot(
    adapted,
    [
      { id: 'total', kind: 'sum' },
      { id: 'count', kind: 'count' }
    ],
    '2026-08-16T00:00:00.000Z'
  )
  assert.deepEqual(snapshot.contributorEntryIds, ['keep-a', 'keep-b'])
  assert.equal(snapshot.metrics.find((metric) => metric.id === 'total')?.value, 30)
  assert.equal(JSON.parse(JSON.stringify(snapshot)).schemaVersion, 1)
})
