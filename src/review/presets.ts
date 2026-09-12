import type { ExtractionSource, ReviewPresetState, ReviewStatus } from '../shared/contracts'
import type { ReviewQueueReasonCode } from './queue'

export interface ReviewFilterPresetFilters {
  status?: ReviewStatus | 'all'
  source?: ExtractionSource | 'all'
  category?: string | 'all'
  /** 'any' matches an entry with at least one queue reason; 'all' does not filter by queue reason. */
  queueReasonCode?: ReviewQueueReasonCode | 'any' | 'all'
}

export type ReviewFilterPreset = ReviewPresetState

interface BuiltInPresetSeed {
  slug: string
  name: string
  filters: ReviewFilterPresetFilters
}

const BUILT_IN_PRESET_SEEDS: readonly BuiltInPresetSeed[] = [
  { slug: 'needs-attention', name: 'Needs attention', filters: { queueReasonCode: 'any' } },
  { slug: 'ocr-only', name: 'OCR only', filters: { queueReasonCode: 'ocr-derived' } },
  { slug: 'low-confidence', name: 'Low confidence', filters: { queueReasonCode: 'low-confidence' } },
  {
    slug: 'possible-duplicates',
    name: 'Possible duplicates',
    filters: { queueReasonCode: 'duplicate-candidate' }
  },
  {
    slug: 'unmapped-financial-rows',
    name: 'Unmapped financial rows',
    filters: { queueReasonCode: 'unmapped-financial-row' }
  }
]

/** Deterministic ids keep built-in presets stable across reopen instead of re-randomizing them. */
export function createBuiltInReviewPresets(
  scope: ReviewFilterPreset['scope'],
  createdAt: string
): ReviewFilterPreset[] {
  return BUILT_IN_PRESET_SEEDS.map((seed) => ({
    id: `built-in:${seed.slug}`,
    name: seed.name,
    scope,
    filters: seed.filters,
    createdAt,
    updatedAt: createdAt
  }))
}
