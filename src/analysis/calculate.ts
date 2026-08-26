import { normalizeNumber } from './normalize'
import type {
  AnalysisDataset,
  AnalysisEntry,
  ComputedMetric,
  MetricDefinition,
  MetricKind,
  NumericNormalizationOptions
} from './types'

interface NumericContributor {
  id: string
  value: number
  category: string
}

function stableEntries(entries: readonly AnalysisEntry[]): AnalysisEntry[] {
  return [...entries].sort((left, right) => left.id.localeCompare(right.id))
}

export function projectKeptDataset(
  entries: readonly AnalysisEntry[],
  options: NumericNormalizationOptions = {}
): AnalysisDataset {
  const kept = stableEntries(entries.filter((entry) => entry.status === 'keep'))
  const valid: AnalysisEntry[] = []
  const invalidEntryIds: string[] = []
  for (const entry of kept) {
    const normalized = normalizeNumber(entry.value, options)
    if (normalized.value === null) invalidEntryIds.push(entry.id)
    else valid.push({ ...entry, value: normalized.value })
  }
  return {
    entries: valid,
    contributorEntryIds: valid.map((entry) => entry.id),
    excludedEntryIds: stableEntries(entries.filter((entry) => entry.status !== 'keep')).map(
      (entry) => entry.id
    ),
    invalidEntryIds
  }
}

function contributors(dataset: AnalysisDataset): NumericContributor[] {
  return dataset.entries.map((entry) => ({
    id: entry.id,
    value: entry.value as number,
    category: entry.category?.trim() || 'Uncategorized'
  }))
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? null)
}

function valueFor(kind: MetricKind, values: readonly number[]): number | null {
  if (kind === 'count') return values.length
  if (values.length === 0) return null
  if (kind === 'sum') return values.reduce((total, value) => total + value, 0)
  if (kind === 'min') return Math.min(...values)
  if (kind === 'max') return Math.max(...values)
  if (kind === 'average') return values.reduce((total, value) => total + value, 0) / values.length
  if (kind === 'median') return median(values)
  if (kind === 'percent') return values.reduce((total, value) => total + value, 0) / values.length
  return null
}

export function calculateMetric(
  dataset: AnalysisDataset,
  definition: MetricDefinition
): ComputedMetric[] {
  const items = contributors(dataset)
  if (!definition.groupByCategory) {
    return [
      {
        id: definition.id,
        kind: definition.kind,
        value: valueFor(
          definition.kind,
          items.map((item) => item.value)
        ),
        contributorEntryIds: items.map((item) => item.id)
      }
    ]
  }

  const groups = new Map<string, NumericContributor[]>()
  for (const item of items) groups.set(item.category, [...(groups.get(item.category) ?? []), item])
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, groupItems]) => ({
      id: `${definition.id}:${group}`,
      kind: definition.kind,
      group,
      value: valueFor(
        definition.kind,
        groupItems.map((item) => item.value)
      ),
      contributorEntryIds: groupItems.map((item) => item.id)
    }))
}

export function calculateMetrics(
  dataset: AnalysisDataset,
  definitions: readonly MetricDefinition[]
): ComputedMetric[] {
  return definitions.flatMap((definition) => calculateMetric(dataset, definition))
}
