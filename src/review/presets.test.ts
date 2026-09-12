import assert from 'node:assert/strict'
import test from 'node:test'

import { createBuiltInReviewPresets } from './presets'

test('creates the five named presets with stable ids and the requested scope', () => {
  const presets = createBuiltInReviewPresets('project', '2026-01-01T00:00:00.000Z')

  assert.deepEqual(
    presets.map((preset) => preset.name),
    [
      'Needs attention',
      'OCR only',
      'Low confidence',
      'Possible duplicates',
      'Unmapped financial rows'
    ]
  )
  assert.deepEqual(
    presets.map((preset) => preset.id),
    [
      'built-in:needs-attention',
      'built-in:ocr-only',
      'built-in:low-confidence',
      'built-in:possible-duplicates',
      'built-in:unmapped-financial-rows'
    ]
  )
  assert.ok(presets.every((preset) => preset.scope === 'project'))
})

test('maps each preset to the matching queue reason code', () => {
  const [needsAttention, ocrOnly, lowConfidence, duplicates, unmapped] =
    createBuiltInReviewPresets('global', '2026-01-01T00:00:00.000Z')

  assert.equal(needsAttention?.filters.queueReasonCode, 'any')
  assert.equal(ocrOnly?.filters.queueReasonCode, 'ocr-derived')
  assert.equal(lowConfidence?.filters.queueReasonCode, 'low-confidence')
  assert.equal(duplicates?.filters.queueReasonCode, 'duplicate-candidate')
  assert.equal(unmapped?.filters.queueReasonCode, 'unmapped-financial-row')
})

test('produces identical output for the same inputs', () => {
  const first = createBuiltInReviewPresets('project', '2026-01-01T00:00:00.000Z')
  const second = createBuiltInReviewPresets('project', '2026-01-01T00:00:00.000Z')

  assert.deepEqual(first, second)
})
