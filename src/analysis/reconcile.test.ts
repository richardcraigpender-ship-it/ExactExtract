import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import { mapFinancialEntry, reconcileFinancialEntries } from './reconcile'

function entry(id: string, text: string): ProjectEntry {
  return {
    id,
    rawText: text,
    normalizedText: text,
    source: 'parser',
    status: 'keep',
    confidence: 0.9,
    regions: [],
    tags: ['accounting'],
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z'
  }
}

const mapping = {
  amountColumns: ['money-out', 'balance'] as const,
  dateSource: 'detected-date' as const,
  descriptionSource: 'detected-description' as const,
  referenceSource: 'ignore' as const,
  categorySource: 'ignore' as const
}

test('maps statement text into configured financial columns', () => {
  const row = mapFinancialEntry(entry('one', '20 Mar 2026 Uber Eats £25.72 £1,404.73'), mapping)
  assert.deepEqual(row, {
    entryId: 'one',
    date: '20 Mar 2026',
    payee: 'Uber Eats',
    description: 'Uber Eats',
    moneyOut: 25.72,
    moneyIn: 0,
    balance: 1404.73
  })
  assert.equal(row?.payee, 'Uber Eats')
})

test('maps optional reference and category entry fields', () => {
  const source = {
    ...entry('one', '20 Mar 2026 Transfer £10.00 £100.00'),
    notes: 'REF-42',
    category: 'Transfer'
  }
  const row = mapFinancialEntry(source, {
    ...mapping,
    referenceSource: 'entry-notes',
    categorySource: 'entry-category'
  })
  assert.equal(row?.reference, 'REF-42')
  assert.equal(row?.category, 'Transfer')
})

test('reconciles opening, movements, and closing balance', () => {
  const result = reconcileFinancialEntries(
    [
      entry('one', '20 Mar 2026 First £25.72 £1,404.73'),
      entry('two', '20 Mar 2026 Second £12.12 £1,392.61')
    ],
    mapping
  )
  assert.equal(result.openingBalance, 1430.45)
  assert.equal(result.closingBalance, 1392.61)
  assert.equal(result.calculatedClosingBalance, 1392.61)
  assert.ok(result.reconciled)
})

test('ignores card and reference digits in transaction detail lines', () => {
  const row = mapFinancialEntry(
    entry(
      'transaction',
      '25 Aug 2024 Payment from PENDER RC £11.23 £25.18 From: PENDER RC, 28429591 Card: 4165499354'
    ),
    mapping
  )
  assert.deepEqual(row, {
    entryId: 'transaction',
    date: '25 Aug 2024',
    payee: 'Payment from PENDER RC',
    description: 'Payment from PENDER RC',
    moneyOut: 0,
    moneyIn: 11.23,
    balance: 25.18
  })
})

test('handles ordinal dates without truncating the description', () => {
  const row = mapFinancialEntry(
    entry('ordinal-date', '28th March 2026 Payment from MRS A. R. Smith money in £1,523.40'),
    {
      ...mapping,
      amountColumns: ['money-in'] as const
    }
  )

  assert.equal(row?.date, '28th March 2026')
  assert.equal(row?.payee, 'Payment from MRS A. R. Smith')
  assert.equal(row?.description, 'Payment from MRS A. R. Smith')
  assert.equal(row?.moneyIn, 1523.4)
})

test('normalizes existing entry payees with trailing direction labels', () => {
  const source = {
    ...entry('stale-payee', '28th March 2026 Payment from MRS A. R. Smith money in £1,523.40'),
    payee: 'Payment from MRS A. R. Smith money in'
  }
  const row = mapFinancialEntry(source, {
    ...mapping,
    amountColumns: ['money-in'] as const
  })

  assert.equal(row?.payee, 'Payment from MRS A. R. Smith')
  assert.equal(row?.description, 'Payment from MRS A. R. Smith')
})

test('completes stale payment-from payees from non-reference notes', () => {
  const source = {
    ...entry('stale-split-payee', '28th March 2026 Payment from £1,523.40'),
    payee: 'Payment from',
    notes: 'MRS A. R. Smith\nCard 4165'
  }
  const row = mapFinancialEntry(source, {
    ...mapping,
    amountColumns: ['money-in'] as const,
    referenceSource: 'entry-notes' as const
  })

  assert.equal(row?.payee, 'Payment from MRS A. R. Smith')
  assert.equal(row?.description, 'Payment from MRS A. R. Smith')
  assert.equal(row?.reference, 'Card 4165')
})

test('does not map undated reference-only detail as a financial row', () => {
  assert.equal(
    mapFinancialEntry(entry('detail', 'Card: 4165499354 Reference: RICHARD 28429591'), mapping),
    null
  )
})

test('infers incoming transaction direction when zero columns are omitted', () => {
  const row = mapFinancialEntry(
    entry('incoming', '25 Aug 2024 Payment from PENDER RC £11.23 £25.18'),
    mapping
  )

  assert.equal(row?.moneyOut, 0)
  assert.equal(row?.moneyIn, 11.23)
  assert.equal(row?.balance, 25.18)
})

test('recognizes Revolut transfer and top-up descriptions as incoming', () => {
  for (const description of ['Transfer from ANATOLIJS VARJAGINS', 'Top-up by *****']) {
    const row = mapFinancialEntry(
      entry('incoming', `25 Aug 2024 ${description} £20.00 £100.00`),
      mapping
    )
    assert.equal(row?.moneyIn, 20)
    assert.equal(row?.moneyOut, 0)
    assert.equal(row?.balance, 100)
  }
})
