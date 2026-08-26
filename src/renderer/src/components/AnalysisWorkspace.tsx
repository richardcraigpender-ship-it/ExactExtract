import React, { useCallback, useMemo, useState } from 'react'
import type { ProjectEntry } from '../../../shared/contracts'
import {
  calculateStatementStats,
  reconcileFinancialEntries,
  type AmountColumnRole,
  type AnalysisSnapshot,
  type FinancialColumnMapping
} from '../../../analysis'
import type { AnalysisConfiguration } from '../analysisPersistence'
import { AnalysisPanel } from './AnalysisPanel'
import './AnalysisWorkspace.css'

interface AnalysisWorkspaceProps {
  entries: readonly ProjectEntry[]
  configuration: AnalysisConfiguration
  snapshot: AnalysisSnapshot
  onNavigateToEntry: (entryId: string) => void
  onConfigurationChange: (configuration: AnalysisConfiguration) => void
}

export const AnalysisWorkspace = React.memo(function AnalysisWorkspace({
  entries,
  configuration,
  snapshot,
  onNavigateToEntry,
  onConfigurationChange
}: AnalysisWorkspaceProps): React.JSX.Element {
  const threshold = configuration.validationOptions.lowConfidenceThreshold ?? 0.7
  const reconciliation = useMemo(
    () => reconcileFinancialEntries(entries, configuration.financialMapping),
    [configuration.financialMapping, entries]
  )
  const [dataset, setDataset] = useState<'all' | 'kept'>('all')
  const statementStats = useMemo(
    () => calculateStatementStats(entries, configuration.financialMapping, dataset),
    [configuration.financialMapping, dataset, entries]
  )
  const currencyCode = 'GBP'
  const currency = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode
      }),
    [currencyCode]
  )
  const currencyDescription = `All monetary values in this section are in ${currencyCode}.`
  const amountRoles = useMemo<Array<{ value: AmountColumnRole; label: string }>>(
    () => [
      { value: 'money-out', label: 'Money out' },
      { value: 'money-in', label: 'Money in' },
      { value: 'balance', label: 'Balance' },
      { value: 'ignore', label: 'Ignore' }
    ],
    []
  )
  const updateMapping = useCallback(
    (patch: Partial<FinancialColumnMapping>): void => {
      onConfigurationChange({
        ...configuration,
        financialMapping: { ...configuration.financialMapping, ...patch }
      })
    },
    [configuration, onConfigurationChange]
  )

  return (
    <section className="analysis-workspace">
      <div className="analysis-controls" aria-label="Analysis configuration">
        <label>
          <span>Low confidence threshold</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={threshold}
            onChange={(event) =>
              onConfigurationChange({
                ...configuration,
                validationOptions: {
                  ...configuration.validationOptions,
                  lowConfidenceThreshold: Math.min(1, Math.max(0, Number(event.target.value)))
                }
              })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={configuration.validationOptions.includeExcludedNotices !== false}
            onChange={(event) =>
              onConfigurationChange({
                ...configuration,
                validationOptions: {
                  ...configuration.validationOptions,
                  includeExcludedNotices: event.target.checked
                }
              })
            }
          />
          <span>Show excluded-entry notices</span>
        </label>
      </div>
      <section className="reconciliation-panel" aria-labelledby="reconciliation-title">
        <header>
          <div>
            <span>ACCOUNTING</span>
            <h3 id="reconciliation-title">Balance reconciliation</h3>
          </div>
          <strong className={reconciliation.reconciled ? 'is-reconciled' : 'is-unreconciled'}>
            {reconciliation.reconciled ? 'Reconciled' : 'Review mapping'}
          </strong>
        </header>
        <p className="sr-only">{currencyDescription}</p>
        <p>Map entry fields and assign monetary values in left-to-right order.</p>
        <div className="semantic-mapping-grid">
          <label>
            <span>Date</span>
            <select
              value={configuration.financialMapping.dateSource}
              onChange={(event) =>
                updateMapping({
                  dateSource: event.target.value as FinancialColumnMapping['dateSource']
                })
              }
            >
              <option value="detected-date">Detected date</option>
              <option value="entry-date">Entry date</option>
              <option value="ignore">Ignore</option>
            </select>
          </label>
          <label>
            <span>Description</span>
            <select
              value={configuration.financialMapping.descriptionSource}
              onChange={(event) =>
                updateMapping({
                  descriptionSource: event.target
                    .value as FinancialColumnMapping['descriptionSource']
                })
              }
            >
              <option value="detected-description">Detected description</option>
              <option value="normalized-text">Normalized text</option>
              <option value="raw-text">Raw text</option>
              <option value="ignore">Ignore</option>
            </select>
          </label>
          <label>
            <span>Reference</span>
            <select
              value={configuration.financialMapping.referenceSource}
              onChange={(event) =>
                updateMapping({
                  referenceSource: event.target.value as FinancialColumnMapping['referenceSource']
                })
              }
            >
              <option value="entry-notes">Entry notes</option>
              <option value="ignore">Ignore</option>
            </select>
          </label>
          <label>
            <span>Category</span>
            <select
              value={configuration.financialMapping.categorySource}
              onChange={(event) =>
                updateMapping({
                  categorySource: event.target.value as FinancialColumnMapping['categorySource']
                })
              }
            >
              <option value="entry-category">Entry category</option>
              <option value="ignore">Ignore</option>
            </select>
          </label>
        </div>
        <div className="column-mapping-grid">
          {Array.from({ length: 3 }, (_, index) => (
            <label key={index}>
              <span>Amount {index + 1}</span>
              <select
                value={configuration.financialMapping.amountColumns[index] ?? 'ignore'}
                onChange={(event) => {
                  const amountColumns = [...configuration.financialMapping.amountColumns]
                  amountColumns[index] = event.target.value as AmountColumnRole
                  updateMapping({ amountColumns })
                }}
              >
                {amountRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <dl className="reconciliation-summary">
          <div>
            <dt>Opening</dt>
            <dd>
              {reconciliation.openingBalance === null
                ? '—'
                : currency.format(reconciliation.openingBalance)}
            </dd>
          </div>
          <div>
            <dt>Calculated close</dt>
            <dd>
              {reconciliation.calculatedClosingBalance === null
                ? '—'
                : currency.format(reconciliation.calculatedClosingBalance)}
            </dd>
          </div>
          <div>
            <dt>Statement close</dt>
            <dd>
              {reconciliation.closingBalance === null
                ? '—'
                : currency.format(reconciliation.closingBalance)}
            </dd>
          </div>
          <div>
            <dt>Difference</dt>
            <dd>
              {reconciliation.difference === null
                ? '—'
                : currency.format(reconciliation.difference)}
            </dd>
          </div>
        </dl>
      </section>
      <section className="statement-stats-panel" aria-labelledby="statement-stats-title">
        <header className="statement-stats-header">
          <div>
            <span>STATEMENT TOTALS</span>
            <h3 id="statement-stats-title">Monthly financial activity</h3>
          </div>
          <div className="statement-dataset-tabs" role="tablist" aria-label="Statement dataset">
            {(['all', 'kept'] as const).map((option) => (
              <button
                key={option}
                className={dataset === option ? 'is-active' : ''}
                type="button"
                role="tab"
                aria-selected={dataset === option}
                onClick={() => setDataset(option)}
              >
                {option === 'all' ? 'All extracted' : 'Kept entries'}
              </button>
            ))}
          </div>
        </header>
        <p className="sr-only">{currencyDescription}</p>
        <div className="statement-stats-summary">
          <div>
            <span>Money in</span>
            <strong>{currency.format(statementStats.moneyIn)}</strong>
          </div>
          <div>
            <span>Money out</span>
            <strong>{currency.format(statementStats.moneyOut)}</strong>
          </div>
          <div>
            <span>Net movement</span>
            <strong>{currency.format(statementStats.netMovement)}</strong>
          </div>
          <div>
            <span>Balance total</span>
            <strong>{currency.format(statementStats.balanceTotal)}</strong>
          </div>
        </div>
        <p className="statement-stats-note">
          Balance total is the sum of balance snapshots. Closing balance uses the final
          chronological snapshot.
        </p>
        <div className="statement-month-table-wrap">
          <table className="statement-month-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Rows</th>
                <th>Money in</th>
                <th>Money out</th>
                <th>Net</th>
                <th>Closing balance</th>
              </tr>
            </thead>
            <tbody>
              {statementStats.months.map((month) => (
                <tr key={month.key}>
                  <th scope="row">{month.label}</th>
                  <td>{month.rowCount}</td>
                  <td>{currency.format(month.moneyIn)}</td>
                  <td>{currency.format(month.moneyOut)}</td>
                  <td>{currency.format(month.netMovement)}</td>
                  <td>
                    {month.closingBalance === null ? '—' : currency.format(month.closingBalance)}
                  </td>
                </tr>
              ))}
              {statementStats.months.length === 0 && (
                <tr>
                  <td colSpan={6}>No mappable financial rows.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <dl className="statement-stats-reconciliation">
          <div>
            <dt>Rows not mapped</dt>
            <dd>
              {statementStats.invalidRowCount} of {statementStats.sourceRowCount}
            </dd>
          </div>
          <div>
            <dt>Calculated close</dt>
            <dd>
              {statementStats.calculatedClosingBalance === null
                ? '—'
                : currency.format(statementStats.calculatedClosingBalance)}
            </dd>
          </div>
          <div>
            <dt>Statement close</dt>
            <dd>
              {statementStats.closingBalance === null
                ? '—'
                : currency.format(statementStats.closingBalance)}
            </dd>
          </div>
          <div>
            <dt>Difference</dt>
            <dd>
              {statementStats.difference === null
                ? '—'
                : currency.format(statementStats.difference)}
            </dd>
          </div>
        </dl>
        <section className="payee-evidence-panel" aria-labelledby="payee-evidence-title">
          <header>
            <div>
              <span>PAYEE EVIDENCE</span>
              <h4 id="payee-evidence-title">Mapped business descriptions</h4>
            </div>
            <span>{statementStats.rows.length} mapped rows</span>
          </header>
          <p className="statement-stats-note">
            Payee text is derived evidence. It remains separate from the original extracted text.
          </p>
          <div className="payee-evidence-table-wrap">
            <table className="payee-evidence-table">
              <thead>
                <tr>
                  <th>Payee</th>
                  <th>Source entry</th>
                  <th>Occurrences</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...new Map(
                    statementStats.rows.map((row) => [
                      row.payee?.trim() || '(unmapped description)',
                      statementStats.rows.filter(
                        (candidate) =>
                          (candidate.payee?.trim() || '(unmapped description)') ===
                          (row.payee?.trim() || '(unmapped description)')
                      )
                    ])
                  )
                ]
                  .sort(([left], [right]) => left.localeCompare(right))
                  .map(([payee, rows]) => (
                    <tr key={payee}>
                      <th scope="row">{payee}</th>
                      <td>
                        {rows
                          .slice(0, 3)
                          .map((row) => row.entryId)
                          .join(', ')}
                        {rows.length > 3 ? ` +${rows.length - 3} more` : ''}
                      </td>
                      <td>{rows.length}</td>
                    </tr>
                  ))}
                {statementStats.rows.length === 0 && (
                  <tr>
                    <td colSpan={3}>No mapped payee evidence for this dataset.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {statementStats.unmappedEntryIds.length > 0 && (
            <p className="payee-evidence-unmapped" role="status">
              {statementStats.unmappedEntryIds.length} source entr
              {statementStats.unmappedEntryIds.length === 1 ? 'y is' : 'ies are'} not mapped to
              financial columns and remain available in Review.
            </p>
          )}
        </section>
      </section>
      <AnalysisPanel entries={entries} snapshot={snapshot} onNavigateToEntry={onNavigateToEntry} />
    </section>
  )
})
