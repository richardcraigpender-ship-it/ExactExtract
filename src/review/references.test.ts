import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import { copyKeptEntryReferencesToNotes, extractEntryReferences } from './references'

function entry(
  id: string,
  normalizedText: string,
  status: ProjectEntry['status'] = 'keep',
  notes?: string
): ProjectEntry {
  return {
    id,
    rawText: normalizedText,
    normalizedText,
    source: 'parser',
    status,
    confidence: 0.9,
    regions: [{ documentId: 'document-1', pageNumber: 1 }],
    tags: [],
    ...(notes ? { notes } : {}),
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  }
}

test('extracts distinct reference markers from entry text', () => {
  assert.deepEqual(
    extractEntryReferences(entry('a', 'Coffee Ref CARD-100 and receipt RCPT-22 and Ref CARD-100')),
    ['CARD-100', 'RCPT-22']
  )
})

test('copies detected references into kept entry notes only', () => {
  const result = copyKeptEntryReferencesToNotes(
    [
      entry('keep', 'Shop card CARD-100'),
      entry('maybe', 'Maybe ref MAY-200', 'maybe'),
      entry('exclude', 'Excluded invoice INV-300', 'exclude')
    ],
    '2026-09-01T12:00:00.000Z'
  )

  assert.equal(result.updatedEntryCount, 1)
  assert.equal(result.copiedReferenceCount, 1)
  assert.equal(result.entries.find((item) => item.id === 'keep')?.notes, 'CARD-100')
  assert.equal(result.entries.find((item) => item.id === 'maybe')?.notes, undefined)
  assert.equal(result.entries.find((item) => item.id === 'exclude')?.notes, undefined)
})

test('appends missing references without duplicating existing notes', () => {
  const result = copyKeptEntryReferencesToNotes(
    [entry('keep', 'Order PO-123 receipt RCPT-456', 'keep', 'Already checked PO-123')],
    '2026-09-01T12:00:00.000Z'
  )

  assert.equal(result.updatedEntryCount, 1)
  assert.equal(result.copiedReferenceCount, 1)
  assert.equal(result.entries[0]?.notes, 'Already checked PO-123\nRCPT-456')
})

test('returns original entry objects when no notes need changing', () => {
  const source = [entry('keep', 'Plain entry without marker')]
  const result = copyKeptEntryReferencesToNotes(source, '2026-09-01T12:00:00.000Z')

  assert.equal(result.updatedEntryCount, 0)
  assert.equal(result.copiedReferenceCount, 0)
  assert.equal(result.entries[0], source[0])
})
