import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import { calculateStatementStats } from './statementStats'

const mapping = {
  amountColumns: ['money-out', 'money-in', 'balance'] as const,
  dateSource: 'detected-date' as const,
  descriptionSource: 'detected-description' as const,
  referenceSource: 'ignore' as const,
  categorySource: 'ignore' as const
}

function entry(id: string, status: ProjectEntry['status'], text: string): ProjectEntry {
  return {
    id,
    rawText: text,
    normalizedText: text,
    source: 'parser',
    status,
    confidence: 0.9,
    regions: [],
    tags: [],
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z'
  }
}

test('calculates all-extracted monthly movements and balance totals', () => {
  const stats = calculateStatementStats(
    [
      entry('march', 'keep', '20 Mar 2026 Shop £10.00 £0.00 £90.00'),
      entry('april', 'exclude', '20 Apr 2026 Refund £100.00 £0.00 £-10.00'),
      entry('may', 'keep', '20 May 2026 Salary £0.00 £100.00 £90.00')
    ],
    mapping,
    'all'
  )

  assert.equal(stats.sourceRowCount, 3)
  assert.equal(stats.invalidRowCount, 0)
  assert.equal(stats.moneyOut, 110)
  assert.equal(stats.moneyIn, 100)
  assert.equal(stats.balanceTotal, 170)
  assert.equal(stats.openingBalance, 100)
  assert.equal(stats.closingBalance, 90)
  assert.equal(stats.calculatedClosingBalance, 90)
  assert.equal(stats.difference, 0)
  assert.deepEqual(stats.months[0]?.contributorEntryIds, ['march'])
  assert.deepEqual(stats.unmappedEntryIds, [])
  assert.equal(stats.months.map((month) => month.label).join('|'), 'March 2026|April 2026|May 2026')
})

test('calculates kept-only stats and tracks invalid source rows', () => {
  const stats = calculateStatementStats(
    [
      entry('kept', 'keep', '20 Mar 2026 Shop £10.00 £0.00 £90.00'),
      entry('excluded', 'exclude', '20 Apr 2026 Refund £0.00 £110.00 £200.00'),
      entry('invalid', 'keep', 'No financial values here')
    ],
    mapping,
    'kept'
  )

  assert.equal(stats.sourceRowCount, 2)
  assert.equal(stats.invalidRowCount, 1)
  assert.equal(stats.moneyOut, 10)
  assert.equal(stats.balanceTotal, 90)
  assert.deepEqual(stats.contributorEntryIds, ['kept'])
  assert.deepEqual(stats.unmappedEntryIds, ['invalid'])
})
