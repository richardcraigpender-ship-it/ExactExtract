import assert from 'node:assert/strict'
import test from 'node:test'

import type { AnalysisEntry } from './types.ts'
import { validateAnalysisEntries } from './validate.ts'

const entries: AnalysisEntry[] = [
  { id: 'keep', status: 'keep', value: '10', confidence: 0.95, duplicateKey: 'same' },
  { id: 'duplicate', status: 'keep', value: '20', confidence: 0.5, duplicateKey: 'same' },
  { id: 'maybe', status: 'maybe', value: '500', uncertain: true },
  { id: 'excluded', status: 'exclude', value: '999' },
  { id: 'invalid', status: 'keep', value: 'bad' },
  { id: 'missing', status: 'keep', value: '' },
  { id: 'outlier', status: 'keep', value: 1000, outlier: true }
]

test('returns typed deterministic issues for every requested condition', () => {
  const issues = validateAnalysisEntries(entries, { expectedTotal: 50 })
  const codes = new Set(issues.map((item) => item.code))
  assert.deepEqual(
    codes,
    new Set([
      'duplicate-entry',
      'excluded-entry',
      'invalid-value',
      'low-confidence',
      'missing-value',
      'outlier',
      'totals-mismatch',
      'uncertain-entry'
    ])
  )
  assert.deepEqual(
    issues,
    [...issues].sort((left, right) => left.id.localeCompare(right.id))
  )
  assert.deepEqual(issues.find((item) => item.code === 'duplicate-entry')?.entryIds, [
    'duplicate',
    'keep'
  ])
})

test('totals mismatch uses kept valid values only', () => {
  const mismatch = validateAnalysisEntries(entries, { expectedTotal: 1030 }).find(
    (item) => item.code === 'totals-mismatch'
  )
  assert.equal(mismatch, undefined)
  const issue = validateAnalysisEntries(entries, { expectedTotal: 30 }).find(
    (item) => item.code === 'totals-mismatch'
  )
  assert.deepEqual(issue?.entryIds, ['duplicate', 'keep', 'outlier'])
  assert.equal(issue?.entryIds.includes('maybe'), false)
  assert.equal(issue?.entryIds.includes('excluded'), false)
})

test('can suppress excluded-entry notices', () => {
  assert.equal(
    validateAnalysisEntries(entries, { includeExcludedNotices: false }).some(
      (item) => item.code === 'excluded-entry'
    ),
    false
  )
})
