import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import {
  clearScannedReferenceNotes,
  copyKeptEntryReferencesToNotes,
  copySourceReferencesToKeptEntryNotes,
  extractEntryReferences
} from './references'

function entry(
  id: string,
  normalizedText: string,
  status: ProjectEntry['status'] = 'keep',
  notes?: string,
  reference?: string
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
    ...(reference ? { reference } : {}),
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

test('copies captured verbatim references into kept entry notes only', () => {
  const result = copyKeptEntryReferencesToNotes(
    [
      entry('keep', 'Shop card CARD-100', 'keep', undefined, 'Card 1112'),
      entry('maybe', 'Maybe ref MAY-200', 'maybe', undefined, 'Card 2223'),
      entry('exclude', 'Excluded invoice INV-300', 'exclude', undefined, 'Card 3334')
    ],
    '2026-09-01T12:00:00.000Z'
  )

  assert.equal(result.updatedEntryCount, 1)
  assert.equal(result.copiedReferenceCount, 1)
  assert.equal(result.entries.find((item) => item.id === 'keep')?.notes, 'Card 1112')
  assert.equal(result.entries.find((item) => item.id === 'maybe')?.notes, undefined)
  assert.equal(result.entries.find((item) => item.id === 'exclude')?.notes, undefined)
})

test('never synthesises reference tokens for an entry without captured text', () => {
  const source = [entry('keep', 'Order PO-123 receipt RCPT-456')]
  const result = copyKeptEntryReferencesToNotes(source, '2026-09-01T12:00:00.000Z')

  assert.equal(result.updatedEntryCount, 0)
  assert.equal(result.entries[0]?.notes, undefined)
})

test('appends the captured reference without duplicating existing notes', () => {
  const result = copyKeptEntryReferencesToNotes(
    [entry('keep', 'Order PO-123', 'keep', 'Already checked', 'To Forest, London, GBR')],
    '2026-09-01T12:00:00.000Z'
  )

  assert.equal(result.updatedEntryCount, 1)
  assert.equal(result.copiedReferenceCount, 1)
  assert.equal(result.entries[0]?.notes, 'Already checked\nTo Forest, London, GBR')
})

test('returns original entry objects when no notes need changing', () => {
  const source = [entry('keep', 'Plain entry without marker')]
  const result = copyKeptEntryReferencesToNotes(source, '2026-09-01T12:00:00.000Z')

  assert.equal(result.updatedEntryCount, 0)
  assert.equal(result.copiedReferenceCount, 0)
  assert.equal(result.entries[0], source[0])
})

test('copies a verbatim detail block into notes without parsing it into tokens', () => {
  const kept = {
    ...entry('keep', 'Forest', 'keep'),
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
        text: 'To Forest, London, GBR',
        detailText: 'To Forest, London, GBR',
        bbox: { x: 54, y: 523, width: 200, height: 8, coordinateSpace: 'pdf-points' }
      }
    ],
    '2026-09-01T12:00:00.000Z'
  )

  // The address line carries no reference marker, so token mode would have produced nothing.
  assert.equal(result.entries[0]?.notes, 'To Forest, London, GBR')
})

test('does not copy a verbatim block that sits on the parent row itself', () => {
  const kept = {
    ...entry('keep', 'Forest', 'keep'),
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
        text: '19 Mar 2026 Forest 2.99',
        detailText: '19 Mar 2026 Forest 2.99',
        bbox: { x: 50, y: 502, width: 300, height: 16, coordinateSpace: 'pdf-points' }
      }
    ],
    '2026-09-01T12:00:00.000Z'
  )

  assert.equal(result.entries[0]?.notes, undefined)
  assert.equal(result.updatedEntryCount, 0)
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
        text: 'Ref WRONG-2',
        bbox: { x: 54, y: 503, width: 80, height: 8, coordinateSpace: 'pdf-points' }
      },
      {
        documentId: 'document-1',
        pageNumber: 1,
        text: 'Ref TOOFAR-3',
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

test('accepts a reference sitting within a row height of its kept parent', () => {
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
        bbox: { x: 54, y: 482, width: 80, height: 8, coordinateSpace: 'pdf-points' }
      }
    ],
    '2026-09-01T12:00:00.000Z'
  )

  assert.equal(result.updatedEntryCount, 1)
  assert.equal(result.tooFarCandidateCount, 0)
  assert.equal(result.entries[0]?.notes, 'CARD-160')
})

test('rejects a reference several rows away from the nearest kept parent', () => {
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

  assert.equal(result.updatedEntryCount, 0)
  assert.equal(result.tooFarCandidateCount, 1)
  assert.equal(result.entries[0], kept)
})

test('rejects a reference in a different column from the kept parent row', () => {
  const kept = {
    ...entry('keep', 'Main transaction row', 'keep'),
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x: 50, y: 500, width: 80, height: 20, coordinateSpace: 'pdf-points' as const }
      }
    ]
  }

  const result = copySourceReferencesToKeptEntryNotes(
    [kept],
    [
      {
        documentId: 'document-1',
        pageNumber: 1,
        text: 'Ref CARD-777',
        bbox: { x: 420, y: 505, width: 80, height: 8, coordinateSpace: 'pdf-points' }
      }
    ],
    '2026-09-01T12:00:00.000Z'
  )

  assert.equal(result.updatedEntryCount, 0)
  assert.equal(result.tooFarCandidateCount, 1)
})

test('does not invent references from ordinary words that start with a marker', () => {
  for (const text of [
    'Revolut Rev Points 250',
    'REV POINTS',
    'Cardholder Jason',
    'Identifier abc',
    'Ordering Smith',
    'Porter Grill'
  ]) {
    assert.deepEqual(extractEntryReferences(entry('a', text)), [], text)
  }
})

test('ignores marker-adjacent words that carry no digits', () => {
  assert.deepEqual(extractEntryReferences(entry('a', 'Order Smith and ref Jason')), [])
  assert.deepEqual(extractEntryReferences(entry('a', 'Order SMITH-12')), ['SMITH-12'])
})

test('clears scanned reference lines while preserving typed notes', () => {
  const result = clearScannedReferenceNotes(
    [
      entry('a', 'Row one', 'keep', 'Checked with the bank\nCARD-100, RCPT-22'),
      entry('b', 'Row two', 'keep', 'PO-123'),
      entry('c', 'Row three', 'keep', 'Call the supplier back')
    ],
    '2026-09-02T12:00:00.000Z'
  )

  assert.equal(result.updatedEntryCount, 2)
  assert.equal(result.removedReferenceCount, 3)
  assert.equal(result.entries[0]?.notes, 'Checked with the bank')
  assert.equal(result.entries[1]?.notes, undefined)
  assert.equal(result.entries[2]?.notes, 'Call the supplier back')
})

test('leaves entries untouched when no scanned reference lines exist', () => {
  const source = [entry('a', 'Row one', 'keep', 'Manual note only')]
  const result = clearScannedReferenceNotes(source, '2026-09-02T12:00:00.000Z')

  assert.equal(result.updatedEntryCount, 0)
  assert.equal(result.removedReferenceCount, 0)
  assert.equal(result.entries[0], source[0])
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
