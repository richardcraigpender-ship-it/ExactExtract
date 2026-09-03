import assert from 'node:assert/strict'
import test from 'node:test'
import {
  entryMatchesReviewFilters,
  filterReviewEntries,
  hasActiveReviewFilters,
  normalizeReviewQuery,
  type ReviewFilterOptions
} from './reviewFiltering'

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

test('detects when review filtering can be skipped entirely', () => {
  assert.equal(
    hasActiveReviewFilters({
      query: '   ',
      reviewStatus: 'all',
      reviewSource: 'all',
      reviewCategory: 'all',
      reviewIssueFilter: 'all'
    }),
    false
  )

  assert.equal(
    hasActiveReviewFilters({
      query: 'acme',
      reviewStatus: 'all',
      reviewSource: 'all',
      reviewCategory: 'all',
      reviewIssueFilter: 'all'
    }),
    true
  )
})

test('shares the same query matching rules used by the renderer filter callback', () => {
  const entry = {
    id: 'entry-1',
    status: 'keep',
    source: 'parser',
    category: 'utility bill',
    tags: ['Priority Review'],
    normalizedText: 'ACME Water Bill'
  } as const

  const options: ReviewFilterOptions = {
    query: 'priority review',
    reviewStatus: 'all',
    reviewSource: 'all',
    reviewCategory: 'all',
    reviewIssueFilter: 'all',
    issuesByEntry: new Map<string, Array<{ code: string }>>()
  }

  assert.equal(entryMatchesReviewFilters(entry, options), true)
  assert.equal(entryMatchesReviewFilters(entry, { ...options, query: 'utility' }), true)
  assert.equal(entryMatchesReviewFilters(entry, { ...options, query: 'northwind' }), false)
})
