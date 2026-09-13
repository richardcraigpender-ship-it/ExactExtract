import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from './contracts'
import {
  applyMerchantDefaultStatusRule,
  applyMerchantDefaultStatusRules,
  previewMerchantDefaultStatusRule
} from './merchantRules'
import type { MerchantRecord } from './merchants'

const merchant: MerchantRecord = {
  id: 'merchant-1',
  canonicalDisplayName: 'Northwind Utilities',
  normalizedKey: 'northwind utilities',
  aliases: ['Northwind'],
  classification: 'merchant-candidate',
  classificationReasons: [],
  userOverride: true,
  recurring: true,
  forecastIncluded: true,
  defaultReviewStatus: 'keep',
  defaultReviewScope: 'future-projects',
  occurrenceCount: 0,
  provenance: [],
  firstSeenAt: '2026-01-01T00:00:00.000Z',
  lastSeenAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

function entry(id: string, payee: string, status: ProjectEntry['status']): ProjectEntry {
  return {
    id,
    rawText: payee,
    normalizedText: payee,
    payee,
    source: 'parser',
    status,
    confidence: 0.9,
    regions: [],
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

test('previews matching aliases, affected entries, and explicit conflicts', () => {
  const preview = previewMerchantDefaultStatusRule(merchant, [
    entry('maybe', 'Northwind', 'maybe'),
    entry('keep', 'Northwind Utilities', 'keep'),
    entry('other', 'Other Shop', 'maybe')
  ])

  assert.equal(preview?.affectedCount, 1)
  assert.equal(preview?.conflictCount, 0)
  assert.deepEqual(preview?.matches.map((match) => match.entryId), ['maybe', 'keep'])
})

test('applies only maybe entries by default and records a reversible decision', () => {
  const result = applyMerchantDefaultStatusRule(
    [entry('maybe', 'Northwind Utilities', 'maybe'), entry('keep', 'Northwind', 'exclude')],
    merchant,
    '2026-09-12T00:00:00.000Z'
  )

  assert.deepEqual(result.changedEntryIds, ['maybe'])
  assert.equal(result.entries[0]?.status, 'keep')
  assert.equal(result.entries[1]?.status, 'exclude')
  assert.equal(result.decision.action, 'set-default-status')
  assert.equal(result.decision.reversible, true)
})

test('can explicitly override conflicts after preview', () => {
  const result = applyMerchantDefaultStatusRule(
    [entry('keep', 'Northwind Utilities', 'exclude')],
    merchant,
    '2026-09-12T00:00:00.000Z',
    { overrideConflicts: true }
  )

  assert.deepEqual(result.changedEntryIds, ['keep'])
  assert.equal(result.entries[0]?.status, 'keep')
})

test('applies stored rules to fresh entries and returns audit decisions', () => {
  const result = applyMerchantDefaultStatusRules(
    [entry('fresh', 'Northwind Utilities', 'maybe')],
    [merchant],
    '2026-09-12T00:00:00.000Z'
  )

  assert.equal(result.entries[0]?.status, 'keep')
  assert.deepEqual(result.changedEntryIds, ['fresh'])
  assert.equal(result.decisions[0]?.appliedToEntryIds[0], 'fresh')
})
