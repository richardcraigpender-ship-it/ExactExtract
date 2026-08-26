import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_ANALYSIS_CONFIGURATION,
  deriveAnalysisState,
  parseAnalysisState,
  serializeAnalysisState,
  type PersistedAnalysisState
} from './analysisPersistence'
import type { ProjectEntry } from '../../shared/contracts'

const state: PersistedAnalysisState = {
  configuration: DEFAULT_ANALYSIS_CONFIGURATION,
  snapshot: {
    schemaVersion: 1,
    generatedAt: '2026-08-16T00:00:00.000Z',
    metricDefinitions: DEFAULT_ANALYSIS_CONFIGURATION.metricDefinitions,
    metrics: [
      {
        id: 'total',
        kind: 'sum',
        value: 30,
        contributorEntryIds: ['keep-a', 'keep-b']
      }
    ],
    issues: [],
    contributorEntryIds: ['keep-a', 'keep-b']
  }
}

test('round-trips JSON-safe Analysis configuration and snapshot data', () => {
  assert.deepEqual(parseAnalysisState(serializeAnalysisState(state)), state)
})

test('rejects malformed and unsupported persisted Analysis state', () => {
  assert.equal(parseAnalysisState(undefined), undefined)
  assert.equal(parseAnalysisState('{bad json'), undefined)
  assert.equal(
    parseAnalysisState(JSON.stringify({ configuration: {}, snapshot: { schemaVersion: 2 } })),
    undefined
  )
})

test('adds the default financial mapping to legacy persisted Analysis state', () => {
  const legacy = {
    ...state,
    configuration: {
      metricDefinitions: state.configuration.metricDefinitions,
      validationOptions: state.configuration.validationOptions
    }
  }
  assert.deepEqual(
    parseAnalysisState(JSON.stringify(legacy))?.configuration.financialMapping.amountColumns,
    ['money-out', 'money-in', 'balance']
  )
  assert.equal(
    parseAnalysisState(JSON.stringify(legacy))?.configuration.financialMapping.descriptionSource,
    'detected-description'
  )
})

test('recalculates persisted kept-only metrics after a review status change', () => {
  const timestamp = '2026-08-16T00:00:00.000Z'
  const entries: ProjectEntry[] = [
    {
      id: 'a',
      rawText: '10',
      normalizedText: '10',
      numericValue: 10,
      source: 'parser',
      status: 'keep',
      confidence: 1,
      regions: [],
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: 'b',
      rawText: '20',
      normalizedText: '20',
      numericValue: 20,
      source: 'parser',
      status: 'keep',
      confidence: 1,
      regions: [],
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ]
  const before = deriveAnalysisState(entries, DEFAULT_ANALYSIS_CONFIGURATION, timestamp)
  const after = deriveAnalysisState(
    entries.map((entry) => (entry.id === 'b' ? { ...entry, status: 'maybe' as const } : entry)),
    DEFAULT_ANALYSIS_CONFIGURATION,
    timestamp
  )

  assert.equal(before.snapshot.metrics.find((metric) => metric.id === 'total')?.value, 30)
  assert.equal(after.snapshot.metrics.find((metric) => metric.id === 'total')?.value, 10)
  assert.deepEqual(after.snapshot.contributorEntryIds, ['a'])
})
