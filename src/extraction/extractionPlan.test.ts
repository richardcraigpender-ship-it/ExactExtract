import assert from 'node:assert/strict'
import test from 'node:test'

import type { DocumentPreflightResult, ExtractionSettings } from '../shared/contracts'
import { createExtractionPlan } from './extractionPlan'

function preflight(): DocumentPreflightResult {
  return {
    documentId: 'document-1',
    kind: 'mixed',
    confidence: 0.9,
    completedAt: '2026-08-15T12:00:00.000Z',
    pages: [
      {
        pageNumber: 3,
        kind: 'image',
        characterCount: 0,
        confidence: 0.98,
        ocrRecommended: true,
        rotation: 0
      },
      {
        pageNumber: 1,
        kind: 'text',
        characterCount: 250,
        confidence: 0.98,
        ocrRecommended: false,
        rotation: 0
      },
      {
        pageNumber: 2,
        kind: 'mixed',
        characterCount: 80,
        confidence: 0.85,
        ocrRecommended: true,
        rotation: 0
      }
    ]
  }
}

function settings(mode: ExtractionSettings['mode'], selectedPages?: number[]): ExtractionSettings {
  return { mode, ocrLanguages: ['eng'], selectedPages }
}

test('plans mode-specific OCR while parsing every page', () => {
  assert.deepEqual(createExtractionPlan(preflight(), settings('fast')).parserPages, [1, 2, 3])
  assert.deepEqual(createExtractionPlan(preflight(), settings('fast')).ocrPages, [3])
  assert.deepEqual(createExtractionPlan(preflight(), settings('balanced')).ocrPages, [2, 3])
  assert.deepEqual(createExtractionPlan(preflight(), settings('maximum')).ocrPages, [1, 2, 3])
  assert.deepEqual(
    createExtractionPlan(preflight(), settings('custom', [3, 1, 3])).ocrPages,
    [1, 3]
  )
})

test('rejects custom pages outside the document', () => {
  assert.throws(() => createExtractionPlan(preflight(), settings('custom', [4])), /must exist/)
})

test('does not mutate settings arrays', () => {
  const source = settings('custom', [3, 1])
  const plan = createExtractionPlan(preflight(), source)
  plan.ocrPages.push(2)
  plan.ocrLanguages.push('fra')

  assert.deepEqual(source.selectedPages, [3, 1])
  assert.deepEqual(source.ocrLanguages, ['eng'])
})
