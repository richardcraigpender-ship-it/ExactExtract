import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import { mergeParserOcrEntries } from './mergeEntries'

function entry(
  id: string,
  source: ProjectEntry['source'],
  text: string,
  x: number,
  confidence: number
): ProjectEntry {
  return {
    id,
    rawText: text,
    normalizedText: text,
    source,
    status: 'maybe',
    confidence,
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x, y: 700, width: 100, height: 12, coordinateSpace: 'pdf-points' }
      }
    ],
    tags: [`source:${source}`],
    createdAt: '2026-08-16T10:00:00.000Z',
    updatedAt: '2026-08-16T10:00:00.000Z'
  }
}

test('merges overlapping canonical text with source attribution and traceability', () => {
  const parser = entry('parser-1', 'parser', 'Total  120', 40, 0.8)
  parser.status = 'keep'
  const ocr = entry('ocr-1', 'ocr', 'total 120', 42, 0.95)

  const result = mergeParserOcrEntries([parser], [ocr])

  assert.equal(result.length, 1)
  assert.equal(result[0]?.source, 'merged')
  assert.equal(result[0]?.status, 'keep')
  assert.equal(result[0]?.confidence, 0.95)
  assert.equal(result[0]?.regions.length, 2)
  assert.deepEqual(result[0]?.tags, ['source:ocr', 'source:parser'])
})

test('does not collapse repeated text in separate page regions', () => {
  const result = mergeParserOcrEntries(
    [entry('parser-1', 'parser', 'Subtotal', 40, 0.9)],
    [entry('ocr-1', 'ocr', 'Subtotal', 300, 0.9)]
  )

  assert.equal(result.length, 2)
  assert.deepEqual(result.map((item) => item.source).sort(), ['ocr', 'parser'])
})

test('matches each OCR entry at most once and does not mutate inputs', () => {
  const parsers = [
    entry('parser-2', 'parser', 'Value', 42, 0.8),
    entry('parser-1', 'parser', 'Value', 40, 0.8)
  ]
  const ocr = entry('ocr-1', 'ocr', 'Value', 40, 0.9)

  const result = mergeParserOcrEntries(parsers, [ocr])
  result[0]?.tags.push('changed')
  if (result[0]?.regions[0]?.bbox) result[0].regions[0].bbox.x = 999

  assert.equal(result.filter((item) => item.source === 'merged').length, 1)
  assert.deepEqual(ocr.tags, ['source:ocr'])
  assert.deepEqual(parsers[0]?.tags, ['source:parser'])
  assert.equal(ocr.regions[0]?.bbox?.x, 40)
  assert.equal(parsers[0]?.regions[0]?.bbox?.x, 42)
})

test('rejects invalid overlap thresholds', () => {
  assert.throws(() => mergeParserOcrEntries([], [], 0), /minimumOverlap/)
})
