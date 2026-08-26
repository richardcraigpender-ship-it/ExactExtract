import { calculateMetrics, projectKeptDataset } from './calculate'
import { validateAnalysisEntries } from './validate'
import type {
  AnalysisEntry,
  AnalysisSnapshot,
  MetricDefinition,
  NumericNormalizationOptions,
  ValidationOptions
} from './types'

export function createAnalysisSnapshot(
  entries: readonly AnalysisEntry[],
  definitions: readonly MetricDefinition[],
  generatedAt: string = new Date().toISOString(),
  normalization: NumericNormalizationOptions = {},
  validation: ValidationOptions = {}
): AnalysisSnapshot {
  if (Number.isNaN(Date.parse(generatedAt))) throw new Error('generatedAt must be an ISO date.')
  const metricDefinitions = [...definitions]
    .map((definition) => ({ ...definition }))
    .sort((left, right) => left.id.localeCompare(right.id))
  const dataset = projectKeptDataset(entries, normalization)
  return {
    schemaVersion: 1,
    generatedAt,
    metricDefinitions,
    metrics: calculateMetrics(dataset, metricDefinitions),
    issues: validateAnalysisEntries(entries, validation),
    contributorEntryIds: [...dataset.contributorEntryIds]
  }
}
