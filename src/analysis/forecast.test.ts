import test from 'node:test'
import assert from 'node:assert/strict'

import type { MerchantRecord } from '../shared/merchants'
import { generateForecast } from './forecast'

function merchant(
  id: string,
  classification: MerchantRecord['classification'] = 'merchant-candidate'
): MerchantRecord {
  return {
    id,
    canonicalDisplayName: id,
    normalizedKey: id,
    aliases: [],
    classification,
    classificationReasons: [],
    userOverride: false,
    recurring: true,
    forecastIncluded: true,
    defaultAmount: 10,
    occurrenceCount: 1,
    provenance: [],
    firstSeenAt: '2026-01-01T00:00:00.000Z',
    lastSeenAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

const assumptions = {
  merchantIds: ['coffee'],
  startDate: '2026-01-01',
  endDate: '2026-02-01',
  cadence: 'monthly' as const,
  seed: 42
}

test('generates reproducible, labelled scenario rows and monthly totals', () => {
  const first = generateForecast([merchant('coffee')], assumptions)
  const second = generateForecast([merchant('coffee')], assumptions)
  assert.deepEqual(first.rows, second.rows)
  assert.equal(
    first.rows.every((row) => row.origin === 'scenario'),
    true
  )
  assert.equal(first.rows.length, 2)
  assert.equal(first.total, 20)
  assert.deepEqual(
    first.monthly.map((month) => month.month),
    ['2026-01', '2026-02']
  )
})

test('does not forecast excluded merchants without explicit inclusion', () => {
  const result = generateForecast([merchant('private', 'excluded')], {
    ...assumptions,
    merchantIds: ['private']
  })
  assert.equal(result.rows.length, 0)
  const included = generateForecast([merchant('private', 'excluded')], {
    ...assumptions,
    merchantIds: ['private'],
    includeExcluded: true
  })
  assert.equal(included.rows.length, 2)
})

test('rejects invalid forecast ranges and variability', () => {
  assert.throws(
    () => generateForecast([merchant('coffee')], { ...assumptions, endDate: '2025-01-01' }),
    /startDate/
  )
  assert.throws(
    () => generateForecast([merchant('coffee')], { ...assumptions, variabilityPercent: 101 }),
    /variabilityPercent/
  )
})

test('creates an exact seeded number of random outgoing rows within spend bounds', () => {
  const options = {
    merchantIds: ['coffee'],
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    cadence: 'monthly' as const,
    randomRowCount: 12,
    minSpend: 5,
    maxSpend: 25,
    seed: 99
  }
  const first = generateForecast([merchant('coffee')], options)
  const second = generateForecast([merchant('coffee')], options)
  assert.deepEqual(first.rows, second.rows)
  assert.equal(first.rows.length, 12)
  assert.equal(
    first.rows.every((row) => row.direction === 'out'),
    true
  )
  assert.equal(
    first.rows.every((row) => (row.numericValue ?? 0) >= 5 && (row.numericValue ?? 0) <= 25),
    true
  )
  assert.equal(
    first.rows.every((row) => row.date && row.date >= '2026-01-01' && row.date <= '2026-01-31'),
    true
  )
})

test('honours an incoming direction for both random and recurring rows', () => {
  const random = generateForecast([merchant('salary')], {
    ...assumptions,
    merchantIds: ['salary'],
    randomRowCount: 4,
    minSpend: 100,
    maxSpend: 200,
    direction: 'in',
    seed: 7
  })
  const recurring = generateForecast([merchant('salary')], {
    ...assumptions,
    merchantIds: ['salary'],
    direction: 'in'
  })

  assert.equal(random.rows.length, 4)
  assert.equal(
    random.rows.every((row) => row.direction === 'in'),
    true
  )
  assert.equal(
    recurring.rows.every((row) => row.direction === 'in'),
    true
  )
})

test('spaces recurring rows by the chosen cadence', () => {
  const weekly = generateForecast([merchant('rent')], {
    ...assumptions,
    merchantIds: ['rent'],
    startDate: '2026-01-01',
    endDate: '2026-01-29',
    cadence: 'weekly'
  })
  const fortnightly = generateForecast([merchant('rent')], {
    ...assumptions,
    merchantIds: ['rent'],
    startDate: '2026-01-01',
    endDate: '2026-01-29',
    cadence: 'fortnightly'
  })

  assert.deepEqual(
    weekly.rows.map((row) => row.date),
    ['2026-01-01', '2026-01-08', '2026-01-15', '2026-01-22', '2026-01-29']
  )
  assert.deepEqual(
    fortnightly.rows.map((row) => row.date),
    ['2026-01-01', '2026-01-15', '2026-01-29']
  )
})

test('rejects invalid random-row and spend-bound settings', () => {
  assert.throws(
    () =>
      generateForecast([merchant('coffee')], {
        ...assumptions,
        randomRowCount: 1.5
      }),
    /randomRowCount/
  )
  assert.throws(
    () =>
      generateForecast([merchant('coffee')], {
        ...assumptions,
        randomRowCount: 2,
        minSpend: 20,
        maxSpend: 10
      }),
    /maxSpend/
  )
})
