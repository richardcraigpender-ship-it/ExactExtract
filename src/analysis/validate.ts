import { normalizeNumber } from './normalize'
import type {
  AnalysisEntry,
  AnalysisValidationIssue,
  ValidationIssueCode,
  ValidationOptions
} from './types'

function issue(
  code: ValidationIssueCode,
  entryIds: string[],
  severity: AnalysisValidationIssue['severity'],
  details?: AnalysisValidationIssue['details']
): AnalysisValidationIssue {
  const sortedIds = [...entryIds].sort((left, right) => left.localeCompare(right))
  return {
    id: `${code}:${sortedIds.join('|') || 'dataset'}`,
    code,
    severity,
    entryIds: sortedIds,
    details
  }
}

export function validateAnalysisEntries(
  entries: readonly AnalysisEntry[],
  options: ValidationOptions = {}
): AnalysisValidationIssue[] {
  const sorted = [...entries].sort((left, right) => left.id.localeCompare(right.id))
  const issues: AnalysisValidationIssue[] = []
  const threshold = options.lowConfidenceThreshold ?? 0.7

  for (const entry of sorted) {
    const normalized = normalizeNumber(entry.value)
    if (normalized.error === 'empty') issues.push(issue('missing-value', [entry.id], 'warning'))
    else if (normalized.value === null) issues.push(issue('invalid-value', [entry.id], 'error'))
    if (
      entry.confidence !== null &&
      entry.confidence !== undefined &&
      entry.confidence < threshold
    ) {
      issues.push(
        issue('low-confidence', [entry.id], 'warning', { confidence: entry.confidence, threshold })
      )
    }
    if (entry.uncertain || entry.status === 'maybe')
      issues.push(issue('uncertain-entry', [entry.id], 'warning'))
    if (entry.outlier) issues.push(issue('outlier', [entry.id], 'warning'))
    if (entry.status === 'exclude' && options.includeExcludedNotices !== false) {
      issues.push(issue('excluded-entry', [entry.id], 'info'))
    }
  }

  const duplicateGroups = new Map<string, string[]>()
  for (const entry of sorted) {
    const key = entry.duplicateKey?.trim()
    if (!key) continue
    duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), entry.id])
  }
  for (const [key, entryIds] of [...duplicateGroups.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    if (entryIds.length > 1)
      issues.push(issue('duplicate-entry', entryIds, 'warning', { duplicateKey: key }))
  }

  if (options.expectedTotal !== undefined) {
    const values = sorted
      .filter((entry) => entry.status === 'keep')
      .map((entry) => ({ id: entry.id, normalized: normalizeNumber(entry.value) }))
      .filter(
        (item): item is { id: string; normalized: { value: number; isPercentage: boolean } } =>
          item.normalized.value !== null
      )
    const actual = values.reduce((total, item) => total + item.normalized.value, 0)
    const tolerance = options.totalTolerance ?? 0.01
    if (Math.abs(actual - options.expectedTotal) > tolerance) {
      issues.push(
        issue(
          'totals-mismatch',
          values.map((item) => item.id),
          'error',
          {
            expected: options.expectedTotal,
            actual,
            difference: actual - options.expectedTotal,
            tolerance
          }
        )
      )
    }
  }

  return issues.sort((left, right) => left.id.localeCompare(right.id))
}
