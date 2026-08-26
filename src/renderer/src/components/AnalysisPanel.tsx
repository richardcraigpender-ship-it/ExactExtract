import React from 'react'
import { AlertTriangle, BarChart3, CheckCircle2 } from 'lucide-react'
import type { ProjectEntry } from '../../../shared/contracts'
import {
  createAnalysisSnapshot,
  navigateToAnalysisIssue,
  projectEntriesToAnalysis,
  type AnalysisSnapshot,
  type MetricDefinition,
  type ValidationOptions
} from '../../../analysis'

const DEFAULT_METRICS: MetricDefinition[] = [
  { id: 'total', kind: 'sum' },
  { id: 'count', kind: 'count' },
  { id: 'average', kind: 'average' },
  { id: 'median', kind: 'median' },
  { id: 'category-total', kind: 'sum', groupByCategory: true }
]

interface AnalysisPanelProps {
  entries: readonly ProjectEntry[]
  snapshot?: AnalysisSnapshot
  metricDefinitions?: readonly MetricDefinition[]
  validationOptions?: ValidationOptions
  onNavigateToEntry?: (entryId: string) => void
}

function formatMetric(value: number | null): string {
  return value === null
    ? 'No data'
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}

export const AnalysisPanel = React.memo(function AnalysisPanel({
  entries,
  snapshot,
  metricDefinitions = DEFAULT_METRICS,
  validationOptions,
  onNavigateToEntry
}: AnalysisPanelProps): React.JSX.Element {
  const result =
    snapshot ??
    createAnalysisSnapshot(
      projectEntriesToAnalysis(entries),
      metricDefinitions,
      new Date().toISOString(),
      {},
      validationOptions
    )
  const overall = result.metrics.filter((metric) => metric.group === undefined)
  const grouped = result.metrics.filter((metric) => metric.group !== undefined)
  const keptCount = entries.filter((entry) => entry.status === 'keep').length
  const maybeCount = entries.filter((entry) => entry.status === 'maybe').length
  const excludedCount = entries.filter((entry) => entry.status === 'exclude').length

  return (
    <section className="analysis-panel" aria-label="Analysis and validation">
      <header className="analysis-header">
        <div>
          <span className="analysis-eyebrow">KEPT-ONLY ANALYSIS</span>
          <h2>Metrics and validation</h2>
        </div>
        <div className="analysis-dataset-summary" aria-label="Review dataset summary">
          <span>
            <strong>{keptCount}</strong> kept
          </span>
          <span>
            <strong>{maybeCount}</strong> maybe
          </span>
          <span>
            <strong>{excludedCount}</strong> excluded
          </span>
        </div>
      </header>

      <div className="analysis-metrics" aria-label="Computed metrics">
        {overall.map((metric) => (
          <article key={metric.id}>
            <BarChart3 size={17} aria-hidden="true" />
            <span>{metric.kind}</span>
            <strong>{formatMetric(metric.value)}</strong>
            <small>{metric.contributorEntryIds.length} contributors</small>
          </article>
        ))}
      </div>

      {grouped.length > 0 && (
        <div className="analysis-groups">
          <h3>Grouped totals</h3>
          <div>
            {grouped.map((metric) => (
              <article key={metric.id}>
                <span>{metric.group}</span>
                <strong>{formatMetric(metric.value)}</strong>
                <small>{metric.contributorEntryIds.length} entries</small>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="analysis-validation">
        <h3>Validation</h3>
        {result.issues.length === 0 ? (
          <div className="analysis-clear">
            <CheckCircle2 size={18} /> No validation issues
          </div>
        ) : (
          <div className="analysis-issues">
            {result.issues.map((issue) => (
              <button
                type="button"
                key={issue.id}
                disabled={!issue.entryIds[0] || !onNavigateToEntry}
                onClick={() => navigateToAnalysisIssue(issue.entryIds, onNavigateToEntry)}
              >
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  <strong>{issue.code.replaceAll('-', ' ')}</strong>
                  <small>{issue.entryIds.length} affected entries</small>
                </span>
                <em>{issue.severity}</em>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
})
