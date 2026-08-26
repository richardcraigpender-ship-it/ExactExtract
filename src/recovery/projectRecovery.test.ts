import assert from 'node:assert/strict'
import test from 'node:test'

import {
  closeGuardMessage,
  matchReplacementSources,
  saveFailureMessage,
  shouldBlockClose,
  sortRecentProjects,
  type RecentProjectRecoveryItem
} from './projectRecovery'

const items: RecentProjectRecoveryItem[] = [
  {
    id: 'old',
    name: 'Old',
    path: 'old.json',
    updatedAt: '2026-08-15T00:00:00.000Z',
    availability: 'available',
    missingSourceCount: 0
  },
  {
    id: 'new',
    name: 'New',
    path: 'new.json',
    updatedAt: '2026-08-16T00:00:00.000Z',
    availability: 'missing',
    missingSourceCount: 2
  }
]

test('sorts recent projects without mutating caller data', () => {
  assert.deepEqual(
    sortRecentProjects(items).map((item) => item.id),
    ['new', 'old']
  )
  assert.deepEqual(
    items.map((item) => item.id),
    ['old', 'new']
  )
})

test('blocks close while dirty or saving with actionable messages', () => {
  assert.equal(shouldBlockClose({ hasUnsavedChanges: false, saveInProgress: false }), false)
  assert.match(
    closeGuardMessage({ hasUnsavedChanges: true, saveInProgress: false }) ?? '',
    /unsaved/i
  )
  assert.match(
    closeGuardMessage({ hasUnsavedChanges: false, saveInProgress: true }) ?? '',
    /saving/i
  )
})

test('blocks close while extraction or export is active with specific messages', () => {
  const idle = { hasUnsavedChanges: false, saveInProgress: false }
  const extracting = { ...idle, extractionInProgress: true }
  const exporting = { ...idle, exportInProgress: true }

  assert.equal(shouldBlockClose(extracting), true)
  assert.match(closeGuardMessage(extracting) ?? '', /extraction/i)
  assert.equal(shouldBlockClose(exporting), true)
  assert.match(closeGuardMessage(exporting) ?? '', /export/i)
})

test('normalizes save failures for retry UI', () => {
  assert.equal(saveFailureMessage(new Error('Disk is full.')), 'Disk is full.')
  assert.match(saveFailureMessage('unknown'), /try again/i)
})

test('matches renamed replacement when one missing source is selected', () => {
  const matches = matchReplacementSources(
    [{ id: 'document-1', name: 'original.pdf' }],
    [{ path: 'moved.pdf', name: 'moved.pdf', size: 42 }]
  )
  assert.equal(matches.get('document-1')?.path, 'moved.pdf')
})

test('matches multiple sources by name before assigning remaining selections by order', () => {
  const matches = matchReplacementSources(
    [
      { id: 'document-1', name: 'first.pdf' },
      { id: 'document-2', name: 'second.pdf' }
    ],
    [
      { path: 'renamed.pdf', name: 'renamed.pdf', size: 10 },
      { path: 'second.pdf', name: 'second.pdf', size: 20 }
    ]
  )
  assert.equal(matches.get('document-1')?.path, 'renamed.pdf')
  assert.equal(matches.get('document-2')?.path, 'second.pdf')
})

test('does not guess when selected replacement count cannot cover unmatched sources', () => {
  const matches = matchReplacementSources(
    [
      { id: 'document-1', name: 'first.pdf' },
      { id: 'document-2', name: 'second.pdf' }
    ],
    [{ path: 'unknown.pdf', name: 'unknown.pdf', size: 10 }]
  )
  assert.equal(matches.size, 0)
})
