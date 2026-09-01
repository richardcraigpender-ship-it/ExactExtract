import assert from 'node:assert/strict'
import test from 'node:test'

import type { KeptExportRunningBalance } from '../shared/keptExportTemplate'
import { buildRunningBalanceValues, type RunningBalanceInputRow } from './runningBalance'

function options(overrides: Partial<KeptExportRunningBalance> = {}): KeptExportRunningBalance {
  return {
    enabled: true,
    fallback: 'first-existing-balance',
    balanceFieldMode: 'add-calculated',
    decimalPlaces: 2,
    ...overrides
  }
}

test('honours a manual opening balance and accumulates money in and out', () => {
  const rows: RunningBalanceInputRow[] = [
    { entryId: 'a', moneyIn: 100 },
    { entryId: 'b', moneyOut: 30 },
    { entryId: 'c', moneyIn: 5.5, moneyOut: 0.5 }
  ]

  const result = buildRunningBalanceValues(rows, options({ openingBalance: 1000 }))

  assert.equal(result.openingBalance, 1000)
  assert.equal(result.openingBalanceSource, 'manual')
  assert.equal(result.values.get('a'), 1100)
  assert.equal(result.values.get('b'), 1070)
  assert.equal(result.values.get('c'), 1075)
})

test('infers the true opening balance from the first detected balance', () => {
  const rows: RunningBalanceInputRow[] = [
    { entryId: 'a', moneyIn: 200, balance: 1200 },
    { entryId: 'b', moneyOut: 50 }
  ]

  const result = buildRunningBalanceValues(rows, options())

  assert.equal(result.openingBalance, 1000)
  assert.equal(result.openingBalanceSource, 'first-existing-balance')
  assert.equal(result.values.get('a'), 1200)
  assert.equal(result.values.get('b'), 1150)
  assert.ok(result.warnings.some((warning) => warning.code === 'running-balance-fallback'))
})

test('uses zero when the zero fallback is selected', () => {
  const rows: RunningBalanceInputRow[] = [{ entryId: 'a', moneyIn: 40, balance: 999 }]

  const result = buildRunningBalanceValues(rows, options({ fallback: 'zero' }))

  assert.equal(result.openingBalance, 0)
  assert.equal(result.openingBalanceSource, 'zero')
  assert.equal(result.values.get('a'), 40)
})

test('falls back to zero and warns when no balance exists to infer from', () => {
  const rows: RunningBalanceInputRow[] = [{ entryId: 'a', moneyIn: 10 }]

  const result = buildRunningBalanceValues(rows, options())

  assert.equal(result.openingBalance, 0)
  assert.equal(result.openingBalanceSource, 'zero')
  assert.equal(result.values.get('a'), 10)
  assert.ok(result.warnings.some((warning) => warning.code === 'running-balance-fallback'))
})

test('carries the previous balance forward for rows without money values', () => {
  const rows: RunningBalanceInputRow[] = [
    { entryId: 'a', moneyIn: 100 },
    { entryId: 'note', financiallyMapped: false },
    { entryId: 'b', moneyOut: 25 }
  ]

  const result = buildRunningBalanceValues(rows, options({ openingBalance: 0 }))

  assert.equal(result.values.get('a'), 100)
  assert.equal(result.values.get('note'), 100)
  assert.equal(result.values.get('b'), 75)
})

test('warns when no row has mappable money columns', () => {
  const rows: RunningBalanceInputRow[] = [
    { entryId: 'a', financiallyMapped: false },
    { entryId: 'b', financiallyMapped: false }
  ]

  const result = buildRunningBalanceValues(rows, options({ openingBalance: 500 }))

  assert.ok(result.warnings.some((warning) => warning.code === 'running-balance-unmappable'))
  assert.equal(result.values.get('a'), 500)
  assert.equal(result.values.get('b'), 500)
})

test('does not mutate the supplied rows and handles an empty row set', () => {
  const rows: RunningBalanceInputRow[] = [{ entryId: 'a', moneyIn: 10, moneyOut: 4 }]
  const snapshot = structuredClone(rows)

  buildRunningBalanceValues(rows, options())
  const empty = buildRunningBalanceValues([], options())

  assert.deepEqual(rows, snapshot)
  assert.equal(empty.values.size, 0)
  assert.equal(empty.openingBalance, 0)
})

test('rounds accumulated floating point movements to currency precision', () => {
  const rows: RunningBalanceInputRow[] = [
    { entryId: 'a', moneyIn: 0.1 },
    { entryId: 'b', moneyIn: 0.2 }
  ]

  const result = buildRunningBalanceValues(rows, options({ openingBalance: 0 }))

  assert.equal(result.values.get('b'), 0.3)
})
