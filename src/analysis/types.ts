export type ReviewStatus = 'keep' | 'exclude' | 'maybe'

export interface AnalysisEntry {
  id: string
  status: ReviewStatus
  value?: unknown
  label?: string | null
  date?: string | null
  category?: string | null
  confidence?: number | null
  duplicateKey?: string | null
  uncertain?: boolean
  outlier?: boolean
}

export interface NormalizedNumber {
  value: number | null
  isPercentage: boolean
  error?: 'empty' | 'invalid' | 'non-finite'
}

export interface NumericNormalizationOptions {
  decimalSeparator?: 'auto' | '.' | ','
  percentageAsFraction?: boolean
}

export type ColumnRole = 'label' | 'amount' | 'date' | 'count' | 'percent' | 'category' | 'ignore'
export type MetricKind = 'sum' | 'count' | 'min' | 'max' | 'average' | 'median' | 'percent'

export interface AnalysisDataset {
  entries: AnalysisEntry[]
  contributorEntryIds: string[]
  excludedEntryIds: string[]
  invalidEntryIds: string[]
}

export interface ComputedMetric {
  id: string
  kind: MetricKind
  value: number | null
  contributorEntryIds: string[]
  group?: string
}

export interface MetricDefinition {
  id: string
  kind: MetricKind
  groupByCategory?: boolean
}

export type ValidationIssueCode =
  | 'invalid-value'
  | 'low-confidence'
  | 'duplicate-entry'
  | 'outlier'
  | 'uncertain-entry'
  | 'excluded-entry'
  | 'missing-value'
  | 'totals-mismatch'

export interface AnalysisValidationIssue {
  id: string
  code: ValidationIssueCode
  severity: 'info' | 'warning' | 'error'
  entryIds: string[]
  details?: Record<string, string | number | boolean | null>
}

export interface ValidationOptions {
  lowConfidenceThreshold?: number
  expectedTotal?: number
  totalTolerance?: number
  includeExcludedNotices?: boolean
}

export interface ColumnSample {
  key: string
  header: string
  values: unknown[]
  explicitRole?: ColumnRole
}

export interface ColumnRoleCandidate {
  role: ColumnRole
  confidence: number
  evidence: string[]
}

export interface ColumnRoleInference {
  key: string
  selectedRole: ColumnRole
  explicit: boolean
  candidates: ColumnRoleCandidate[]
}

export interface AnalysisSnapshot {
  schemaVersion: 1
  generatedAt: string
  metricDefinitions: MetricDefinition[]
  metrics: ComputedMetric[]
  issues: AnalysisValidationIssue[]
  contributorEntryIds: string[]
}
