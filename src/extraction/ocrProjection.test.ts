import assert from 'node:assert/strict'
import test from 'node:test'

import type { OcrRecognizedBlock } from './ocrProjection'
import { projectOcrEntries } from './ocrProjection'

function block(id: string, pageNumber: number, text: string, y: number): OcrRecognizedBlock {
  return {
    id,
    documentId: 'document-1',
    pageNumber,
    text,
    confidence: 0.87,
    bbox: { x: 40, y, width: 120, height: 12, coordinateSpace: 'pdf-points' }
  }
}

test('projects deterministic merge-ready OCR entries with source traceability', () => {
  const source = [block('lower', 1, 'Total   120', 650), block('upper', 1, 'INVOICE', 700)]

  const entries = projectOcrEntries('document-1', source, '2026-08-16T12:00:00.000Z')

  assert.deepEqual(
    entries.map((entry) => entry.id),
    ['ocr:document-1:p1:upper:entry', 'ocr:document-1:p1:lower:entry']
  )
  assert.equal(entries[1]?.normalizedText, 'Total 120')
  assert.equal(entries[0]?.source, 'ocr')
  assert.equal(entries[0]?.regions[0]?.blockId, 'upper')
  assert.equal(entries[0]?.confidence, 0.87)
})

test('rejects malformed provider output', () => {
  const duplicate = block('same', 1, 'First', 700)
  assert.throws(
    () => projectOcrEntries('document-1', [duplicate, { ...duplicate, text: 'Second' }]),
    /Duplicate/
  )
  assert.throws(
    () => projectOcrEntries('document-1', [{ ...block('bad', 1, 'Text', 700), confidence: 87 }]),
    /confidence/
  )
  assert.throws(
    () =>
      projectOcrEntries('document-1', [
        {
          ...block('bad-box', 1, 'Text', 0.9),
          bbox: { x: 0.9, y: 0.9, width: 0.2, height: 0.2, coordinateSpace: 'normalized' }
        }
      ]),
    /fit within/
  )
})

test('does not mutate OCR blocks or nested bounding boxes', () => {
  const source = block('block-1', 1, 'Text', 700)
  const entry = projectOcrEntries('document-1', [source])[0]
  if (entry?.regions[0]?.bbox) entry.regions[0].bbox.x = 999

  assert.equal(source.bbox.x, 40)
})
