import type { ProjectEntry } from '../../shared/contracts'
import {
  createAnalysisSnapshot,
  projectEntriesToAnalysis,
  type AnalysisSnapshot,
  type FinancialColumnMapping,
  type MetricDefinition,
  type ValidationOptions
} from '../../analysis'

export interface AnalysisConfiguration {
  metricDefinitions: MetricDefinition[]
  validationOptions: ValidationOptions
  financialMapping: FinancialColumnMapping
}

export interface PersistedAnalysisState {
  configuration: AnalysisConfiguration
  snapshot: AnalysisSnapshot
}

const DEFAULT_FINANCIAL_MAPPING: FinancialColumnMapping = {
  amountColumns: ['money-out', 'money-in', 'balance'],
  dateSource: 'detected-date',
  descriptionSource: 'detected-description',
  referenceSource: 'entry-notes',
  categorySource: 'entry-category'
}

export const DEFAULT_ANALYSIS_CONFIGURATION: AnalysisConfiguration = {
  metricDefinitions: [
    { id: 'total', kind: 'sum' },
    { id: 'count', kind: 'count' },
    { id: 'average', kind: 'average' },
    { id: 'median', kind: 'median' },
    { id: 'category-total', kind: 'sum', groupByCategory: true }
  ],
  validationOptions: { lowConfidenceThreshold: 0.7, includeExcludedNotices: true },
  financialMapping: DEFAULT_FINANCIAL_MAPPING
}

export function serializeAnalysisState(state: PersistedAnalysisState): string {
  return JSON.stringify(state)
}

export function deriveAnalysisState(
  entries: readonly ProjectEntry[],
  configuration: AnalysisConfiguration,
  generatedAt: string = new Date().toISOString()
): PersistedAnalysisState {
  return {
    configuration,
    snapshot: createAnalysisSnapshot(
      projectEntriesToAnalysis(entries),
      configuration.metricDefinitions,
      generatedAt,
      {},
      configuration.validationOptions
    )
  }
}

export function parseAnalysisState(value: unknown): PersistedAnalysisState | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const parsed = JSON.parse(value) as Partial<PersistedAnalysisState>
    if (!parsed.configuration || !parsed.snapshot || parsed.snapshot.schemaVersion !== 1) {
      return undefined
    }
    return {
      ...(parsed as PersistedAnalysisState),
      configuration: {
        ...parsed.configuration,
        financialMapping: {
          ...DEFAULT_FINANCIAL_MAPPING,
          ...parsed.configuration.financialMapping
        }
      }
    }
  } catch {
    return undefined
  }
}
