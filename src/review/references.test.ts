import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import {
  copyKeptEntryReferencesToNotes,
  copySourceReferencesToKeptEntryNotes,
  extractEntryReferences
} from './references'

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

test('copies source-level references to the nearest kept parent entry on the same page', () => {
  const kept = {
    ...entry('keep', 'Main transaction row', 'keep'),
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x: 50, y: 500, width: 300, height: 20, coordinateSpace: 'pdf-points' as const }
      }
    ]
  }
  const maybe = {
    ...entry('maybe', 'Maybe transaction row', 'maybe'),
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x: 50, y: 100, width: 300, height: 20, coordinateSpace: 'pdf-points' as const }
      }
    ]
  }

  const result = copySourceReferencesToKeptEntryNotes(
    [kept, maybe],
    [
      {
        documentId: 'document-1',
        pageNumber: 1,
        text: 'Ref CARD-999',
        bbox: { x: 54, y: 523, width: 80, height: 8, coordinateSpace: 'pdf-points' }
      },
      {
        documentId: 'document-1',
        pageNumber: 1,
        text: 'Ref MAY-100',
        bbox: { x: 54, y: 103, width: 80, height: 8, coordinateSpace: 'pdf-points' }
      }
    ],
    '2026-09-01T12:00:00.000Z'
  )

  assert.equal(result.updatedEntryCount, 1)
  assert.equal(result.copiedReferenceCount, 1)
  assert.equal(result.candidateCount, 2)
  assert.equal(result.matchedCandidateCount, 1)
  assert.equal(result.matchedEntryCount, 1)
  assert.equal(result.unmatchedCandidateCount, 1)
  assert.equal(result.alreadyPresentReferenceCount, 0)
  assert.equal(result.entries.find((item) => item.id === 'keep')?.notes, 'CARD-999')
  assert.equal(result.entries.find((item) => item.id === 'maybe')?.notes, undefined)
})

test('rejects source references on the wrong page or too far from a kept parent row', () => {
  const kept = {
    ...entry('keep', 'Main transaction row', 'keep'),
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x: 50, y: 500, width: 300, height: 20, coordinateSpace: 'pdf-points' as const }
      }
    ]
  }

  const result = copySourceReferencesToKeptEntryNotes(
    [kept],
    [
      {
        documentId: 'document-1',
        pageNumber: 2,
        text: 'Ref WRONG-PAGE',
        bbox: { x: 54, y: 503, width: 80, height: 8, coordinateSpace: 'pdf-points' }
      },
      {
        documentId: 'document-1',
        pageNumber: 1,
        text: 'Ref TOO-FAR',
        bbox: { x: 54, y: 200, width: 80, height: 8, coordinateSpace: 'pdf-points' }
      }
    ],
    '2026-09-01T12:00:00.000Z',
    { scannedPageCount: 2 }
  )

  assert.equal(result.updatedEntryCount, 0)
  assert.equal(result.copiedReferenceCount, 0)
  assert.equal(result.candidateCount, 2)
  assert.equal(result.matchedCandidateCount, 0)
  assert.equal(result.unmatchedCandidateCount, 2)
  assert.equal(result.alreadyPresentReferenceCount, 0)
  assert.equal(result.scannedPageCount, 2)
  assert.equal(result.entries[0], kept)
})

test('accepts references within the broader default parent matching distance', () => {
  const kept = {
    ...entry('keep', 'Main transaction row', 'keep'),
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x: 50, y: 500, width: 300, height: 20, coordinateSpace: 'pdf-points' as const }
      }
    ]
  }

  const result = copySourceReferencesToKeptEntryNotes(
    [kept],
    [
      {
        documentId: 'document-1',
        pageNumber: 1,
        text: 'Ref CARD-160',
        bbox: { x: 54, y: 360, width: 80, height: 8, coordinateSpace: 'pdf-points' }
      }
    ],
    '2026-09-01T12:00:00.000Z'
  )

  assert.equal(result.updatedEntryCount, 1)
  assert.equal(result.tooFarCandidateCount, 0)
  assert.equal(result.entries[0]?.notes, 'CARD-160')
})

test('uses pre-extracted OCR references and skips duplicate note values', () => {
  const kept = {
    ...entry('keep', 'Main transaction row', 'keep', 'CARD-100'),
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x: 50, y: 500, width: 300, height: 20, coordinateSpace: 'pdf-points' as const }
      }
    ]
  }

  const result = copySourceReferencesToKeptEntryNotes(
    [kept],
    [
      {
        documentId: 'document-1',
        pageNumber: 1,
        text: 'OCR text contained split reference tokens',
        references: ['CARD-100', 'CARD-200'],
        confidence: 0.91,
        source: 'ocr-reference-scan',
        bbox: { x: 54, y: 523, width: 80, height: 8, coordinateSpace: 'pdf-points' }
      }
    ],
    '2026-09-01T12:00:00.000Z'
  )

  assert.equal(result.updatedEntryCount, 1)
  assert.equal(result.copiedReferenceCount, 1)
  assert.equal(result.matchedCandidateCount, 1)
  assert.equal(result.alreadyPresentReferenceCount, 1)
  assert.equal(result.entries[0]?.notes, 'CARD-100\nCARD-200')
})
