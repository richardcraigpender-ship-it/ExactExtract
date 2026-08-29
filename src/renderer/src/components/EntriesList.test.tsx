import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import type { ProjectEntry } from '../../../shared/contracts'
import { EntriesList } from './EntriesList'
import { hasNestedInteractiveTarget } from './entryRowInteraction'

const entry: ProjectEntry = {
  id: 'entry-1',
  rawText: 'Sensitive source wording',
  normalizedText: 'Sensitive source wording',
  source: 'parser',
  status: 'keep',
  confidence: 0.98,
  regions: [{ documentId: 'document-1', pageNumber: 4 }],
  category: 'transaction',
  tags: [],
  createdAt: '2026-08-21T00:00:00.000Z',
  updatedAt: '2026-08-21T00:00:00.000Z'
}

test('renders compact numbered metadata and aligned accessible actions without source text', () => {
  const markup = renderToStaticMarkup(
    <EntriesList
      entries={[entry]}
      selectedEntryId={null}
      selectedEntryIds={new Set()}
      onSelect={() => {}}
      onToggleSelection={() => {}}
      onSetStatus={() => {}}
      onEdit={() => {}}
      onMergeUp={() => {}}
      canMergeUp={() => true}
      onPageJump={() => {}}
    />
  )

  assert.match(markup, /aria-label="Entry 1, keep"/)
  assert.match(markup, />Page 4</)
  assert.match(markup, />transaction</)
  assert.match(markup, />98%</)
  assert.doesNotMatch(markup, /Sensitive source wording/)
  assert.match(markup, /title="Keep entry 1"/)
  assert.match(markup, /title="Edit entry 1"/)
})

test('renders only the visible slice for a long review list', () => {
  const manyEntries = Array.from({ length: 120 }, (_, index) => ({
    ...entry,
    id: `entry-${index + 1}`,
    normalizedText: `Entry ${index + 1}`
  }))

  const markup = renderToStaticMarkup(
    <EntriesList
      entries={manyEntries}
      selectedEntryId={null}
      selectedEntryIds={new Set()}
      onSelect={() => {}}
      onToggleSelection={() => {}}
      onSetStatus={() => {}}
      onEdit={() => {}}
      viewportHeight={120}
      rowHeight={40}
      overscan={1}
    />
  )

  assert.match(markup, /aria-label="Entry 1, keep"/)
  assert.match(markup, /aria-label="Entry 4, keep"/)
  assert.doesNotMatch(markup, /aria-label="Entry 5, keep"/)
  assert.doesNotMatch(markup, /aria-label="Entry 100, keep"/)
})

test('treats nested interactive targets as row-level action boundaries', () => {
  const actionTarget = { closest: (selector: string) => (selector.includes('button') ? {} : null) }
  const plainTarget = { closest: () => null }

  assert.equal(hasNestedInteractiveTarget(actionTarget), true)
  assert.equal(hasNestedInteractiveTarget(plainTarget), false)
  assert.equal(hasNestedInteractiveTarget({}), false)
})
