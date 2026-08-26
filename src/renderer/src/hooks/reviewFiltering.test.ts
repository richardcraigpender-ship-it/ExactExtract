import assert from 'node:assert/strict'
import test from 'node:test'
import { filterReviewEntries, normalizeReviewQuery } from './reviewFiltering'

test('normalizes review queries for shared filtering', () => {
  assert.equal(normalizeReviewQuery('  PAYEE  '), 'payee')
  assert.equal(normalizeReviewQuery('multiple   spaces'), 'multiple spaces')
  assert.equal(normalizeReviewQuery(''), '')
})

test('filters review entries across status, source, issue and query checks', () => {
  const entries = [
    {
      id: 'a',
      status: 'keep',
      source: 'parser',
      category: 'invoice',
      tags: ['priority', 'east'],
      normalizedText: 'Acme Water Bill',
      notes: 'n/a'
    },
    {
      id: 'b',
      status: 'exclude',
      source: 'ocr',
      category: 'invoice',
      tags: ['priority'],
      normalizedText: 'Northwind Invoice',
      notes: 'n/a'
    },
    {
      id: 'c',
      status: 'keep',
      source: 'parser',
      category: 'misc',
      tags: ['follow-up'],
      normalizedText: 'Customer notice',
      notes: 'n/a'
    }
  ] as const

  const issuesByEntry = new Map<string, Array<{ code: string }>>([
    ['a', [{ code: 'missing-date' }]],
    ['c', [{ code: 'duplicate-total' }]]
  ])

  const result = filterReviewEntries(entries, {
    query: 'acme',
    reviewStatus: 'all',
    reviewSource: 'all',
    reviewCategory: 'all',
    reviewIssueFilter: 'missing-date',
    issuesByEntry
  })

  assert.deepEqual(
    result.map((entry) => entry.id),
    ['a']
  )
})
