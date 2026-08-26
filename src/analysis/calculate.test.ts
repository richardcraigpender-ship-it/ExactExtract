import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateMetrics, projectKeptDataset } from './calculate.ts'
import type { AnalysisEntry, MetricDefinition } from './types.ts'

const entries: AnalysisEntry[] = [
  { id: 'keep-b', status: 'keep', value: '$30.00', category: 'Travel' },
  { id: 'excluded', status: 'exclude', value: '999', category: 'Travel' },
  { id: 'keep-a', status: 'keep', value: '10', category: 'Office' },
  { id: 'maybe', status: 'maybe', value: '500', category: 'Office' },
  { id: 'keep-c', status: 'keep', value: '20', category: 'Travel' },
  { id: 'invalid', status: 'keep', value: 'n/a', category: 'Office' }
]

test('projects only kept valid entries in deterministic ID order', () => {
  const dataset = projectKeptDataset(entries)
  assert.deepEqual(dataset.contributorEntryIds, ['keep-a', 'keep-b', 'keep-c'])
  assert.deepEqual(dataset.excludedEntryIds, ['excluded', 'maybe'])
  assert.deepEqual(dataset.invalidEntryIds, ['invalid'])
  assert.equal(
    dataset.entries.some((entry) => entry.id === 'maybe'),
    false
  )
  assert.equal(
    dataset.entries.some((entry) => entry.id === 'excluded'),
    false
  )
})

test('calculates core metrics with contributor IDs', () => {
  const definitions: MetricDefinition[] = [
    { id: 'sum', kind: 'sum' },
    { id: 'count', kind: 'count' },
    { id: 'min', kind: 'min' },
    { id: 'max', kind: 'max' },
    { id: 'average', kind: 'average' },
    { id: 'median', kind: 'median' }
  ]
  const metrics = calculateMetrics(projectKeptDataset(entries), definitions)
  assert.deepEqual(
    metrics.map((metric) => metric.value),
    [60, 3, 10, 30, 20, 20]
  )
  assert.deepEqual(metrics[0]?.contributorEntryIds, ['keep-a', 'keep-b', 'keep-c'])
})

test('calculates sorted grouped totals without maybe or excluded entries', () => {
  const metrics = calculateMetrics(projectKeptDataset(entries), [
    { id: 'group-total', kind: 'sum', groupByCategory: true }
  ])
  assert.deepEqual(
    metrics.map((metric) => [metric.group, metric.value]),
    [
      ['Office', 10],
      ['Travel', 50]
    ]
  )
  assert.equal(metrics.flatMap((metric) => metric.contributorEntryIds).includes('maybe'), false)
})

test('calculates percentage averages and empty values safely', () => {
  const percentage = projectKeptDataset([
    { id: 'p1', status: 'keep', value: '25%' },
    { id: 'p2', status: 'keep', value: '75%' }
  ])
  assert.equal(calculateMetrics(percentage, [{ id: 'percent', kind: 'percent' }])[0]?.value, 0.5)
  assert.equal(
    calculateMetrics(projectKeptDataset([]), [{ id: 'empty', kind: 'sum' }])[0]?.value,
    null
  )
})
