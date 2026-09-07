import React, { useMemo, useState } from 'react'
import { Check, Merge, Pencil, Plus, RefreshCw, ShieldAlert, Trash2, Undo2, X } from 'lucide-react'
import type { EntryDirection, ProjectEntry } from '../../../shared/contracts'
import { generateForecast, type ForecastCadence } from '../../../analysis'
import {
  normalizeMerchantKey,
  type MerchantClassificationReason,
  type MerchantCreate,
  type MerchantRecord,
  type MerchantUpdate
} from '../../../shared/merchants'
import {
  MERCHANT_FILTERS,
  filterMerchantRecords,
  isApproved,
  isLikelyPersonal,
  needsReview,
  type MerchantLibraryFilter
} from './merchantLibraryFilters'
import './MerchantLibraryPanel.css'

const REASON_LABELS: Record<MerchantClassificationReason, string> = {
  'transfer-prefix': 'Transfer wording',
  'email-address': 'Email address',
  'phone-number': 'Phone number',
  'account-like-number': 'Account-like number'
}

function typicalAmount(record: MerchantRecord): number | undefined {
  if (typeof record.defaultAmount === 'number') return record.defaultAmount
  const amounts = record.provenance
    .map((entry) => entry.amount)
    .filter((amount): amount is number => typeof amount === 'number')
  if (amounts.length === 0) return undefined
  const sorted = [...amounts].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

function dominantDirection(record: MerchantRecord): 'in' | 'out' | undefined {
  let inCount = 0
  let outCount = 0
  for (const entry of record.provenance) {
    if (entry.direction === 'in') inCount += 1
    if (entry.direction === 'out') outCount += 1
  }
  if (inCount === 0 && outCount === 0) return undefined
  return inCount > outCount ? 'in' : 'out'
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toISOString().slice(0, 10)
}

function parseAliases(value: string): string[] {
  return value
    .split(',')
    .map((alias) => alias.trim())
    .filter(Boolean)
}

interface MerchantDraft {
  displayName: string
  aliases: string
  category: string
  recurring: boolean
  forecastIncluded: boolean
  defaultAmount: string
  defaultCadence: string
  notes: string
}

const EMPTY_DRAFT: MerchantDraft = {
  displayName: '',
  aliases: '',
  category: '',
  recurring: false,
  forecastIncluded: false,
  defaultAmount: '',
  defaultCadence: 'monthly',
  notes: ''
}

function draftToCreate(draft: MerchantDraft): MerchantCreate {
  const amount = Number.parseFloat(draft.defaultAmount)
  return {
    displayName: draft.displayName.trim(),
    aliases: parseAliases(draft.aliases),
    category: draft.category.trim() || undefined,
    recurring: draft.recurring,
    forecastIncluded: draft.forecastIncluded,
    defaultAmount: Number.isFinite(amount) ? amount : undefined,
    defaultCadence: draft.defaultCadence.trim() || undefined,
    notes: draft.notes.trim() || undefined
  }
}

interface MerchantLibraryPanelProps {
  records: readonly MerchantRecord[]
  isLoading?: boolean
  isRescanning?: boolean
  error?: string
  status?: string
  projectId?: string
  currencySymbol?: string
  canRescan?: boolean
  onApprove: (id: string) => void
  onExclude: (id: string) => void
  onRestore: (id: string) => void
  onToggleForecast: (id: string, included: boolean) => void
  onUpdate: (id: string, update: MerchantUpdate) => void
  onForget: (id: string) => void
  onCreate: (input: MerchantCreate) => void
  onMergeAlias: (targetId: string, alias: string) => void
  onRescanProject: () => void
  onAddScenarioRows?: (rows: readonly ProjectEntry[]) => void
  onNavigateToEntry?: (entryId: string) => void
}

export const MerchantLibraryPanel = React.memo(function MerchantLibraryPanel({
  records,
  isLoading = false,
  isRescanning = false,
  error,
  status,
  projectId,
  currencySymbol = '£',
  canRescan = false,
  onApprove,
  onExclude,
  onRestore,
  onToggleForecast,
  onUpdate,
  onForget,
  onCreate,
  onMergeAlias,
  onRescanProject,
  onAddScenarioRows,
  onNavigateToEntry
}: MerchantLibraryPanelProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MerchantLibraryFilter>('all')
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState<MerchantDraft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<MerchantDraft>(EMPTY_DRAFT)
  const [confirmForgetId, setConfirmForgetId] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<'review' | 'databases'>('review')
  const [forecast, setForecast] = useState({
    mode: 'random' as 'random' | 'recurring',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    randomRowCount: '10',
    minSpend: '5',
    maxSpend: '50',
    cadence: 'monthly' as ForecastCadence,
    amount: '25',
    variabilityPercent: '0',
    direction: 'out' as EntryDirection,
    seed: String(Date.now() % 100000)
  })
  const [forecastMessage, setForecastMessage] = useState<string>()

  const visible = useMemo(
    () =>
      filterMerchantRecords(
        records.filter((record) => {
          if (!onAddScenarioRows) return true
          return panelTab === 'databases'
            ? isApproved(record) || record.classification === 'excluded'
            : !isApproved(record) && record.classification !== 'excluded'
        }),
        filter,
        query,
        projectId
      ),
    [filter, onAddScenarioRows, panelTab, projectId, query, records]
  )

  const duplicate = useMemo(() => {
    const key = normalizeMerchantKey(draft.displayName)
    if (!key) return undefined
    return records.find(
      (record) =>
        record.normalizedKey === key ||
        record.aliases.some((alias) => normalizeMerchantKey(alias) === key)
    )
  }, [draft.displayName, records])

  const counts = useMemo(
    () => ({
      approved: records.filter(isApproved).length,
      review: records.filter((record) => needsReview(record) && !isLikelyPersonal(record)).length,
      personal: records.filter(isLikelyPersonal).length
    }),
    [records]
  )

  const beginEdit = (record: MerchantRecord): void => {
    setEditingId(record.id)
    setEditDraft({
      displayName: record.canonicalDisplayName,
      aliases: record.aliases.join(', '),
      category: record.category ?? '',
      recurring: record.recurring,
      forecastIncluded: record.forecastIncluded,
      defaultAmount: record.defaultAmount?.toString() ?? '',
      defaultCadence: record.defaultCadence ?? '',
      notes: record.notes ?? ''
    })
  }

  return (
    <section className="merchant-library-panel" aria-label="Merchant library">
      <header>
        <div>
          <span className="eyebrow">STORED LOCALLY ONLY</span>
          <h2>Merchant library</h2>
        </div>
        <p>Review what was learned from imported statements. Nothing here is uploaded or shared.</p>
      </header>

      <div className="merchant-library-toolbar">
        <label className="merchant-library-search">
          <span className="visually-hidden">Search merchants</span>
          <input
            type="search"
            placeholder="Search name or alias"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setIsAdding((current) => !current)}
        >
          <Plus size={15} aria-hidden="true" /> Add merchant
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!canRescan || isRescanning}
          onClick={onRescanProject}
          title="Re-derive candidates from this project without discarding your decisions"
        >
          <RefreshCw size={15} aria-hidden="true" />
          {isRescanning ? 'Rescanning…' : 'Rescan project'}
        </button>
      </div>

      <div className="merchant-library-tabs" role="tablist" aria-label="Merchant data views">
        <button
          type="button"
          role="tab"
          aria-selected={panelTab === 'review'}
          className={panelTab === 'review' ? 'is-active' : undefined}
          onClick={() => setPanelTab('review')}
        >
          Review
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panelTab === 'databases'}
          className={panelTab === 'databases' ? 'is-active' : undefined}
          onClick={() => setPanelTab('databases')}
        >
          Databases (
          {counts.approved +
            records.filter((record) => record.classification === 'excluded').length}
          )
        </button>
      </div>

      {panelTab === 'review' && onAddScenarioRows && (
        <form
          className="merchant-library-form merchant-library-forecast"
          aria-label="Merchant forecast"
          onSubmit={(event) => {
            event.preventDefault()
            try {
              const isRandom = forecast.mode === 'random'
              const result = generateForecast(records, {
                merchantIds: records
                  .filter((record) => isApproved(record) && record.forecastIncluded)
                  .map((record) => record.id),
                startDate: forecast.startDate,
                endDate: forecast.endDate,
                cadence: forecast.cadence,
                randomRowCount: isRandom ? Number(forecast.randomRowCount) : 0,
                ...(isRandom
                  ? { minSpend: Number(forecast.minSpend), maxSpend: Number(forecast.maxSpend) }
                  : {
                      amount: Number(forecast.amount),
                      variabilityPercent: Number(forecast.variabilityPercent)
                    }),
                direction: forecast.direction,
                seed: Number(forecast.seed)
              })
              onAddScenarioRows(result.rows)
              setForecastMessage(
                `Added ${result.rows.length} ${forecast.direction === 'out' ? 'outgoing' : 'incoming'} forecast rows.`
              )
            } catch (error) {
              setForecastMessage(
                error instanceof Error ? error.message : 'Unable to create forecast.'
              )
            }
          }}
        >
          <strong>Merchant forecast</strong>
          <label>
            <span>Pattern</span>
            <select
              value={forecast.mode}
              onChange={(event) =>
                setForecast({ ...forecast, mode: event.target.value as 'random' | 'recurring' })
              }
            >
              <option value="random">Random rows</option>
              <option value="recurring">Recurring schedule</option>
            </select>
          </label>
          <label>
            <span>Direction</span>
            <select
              value={forecast.direction}
              onChange={(event) =>
                setForecast({ ...forecast, direction: event.target.value as EntryDirection })
              }
            >
              <option value="out">Money out</option>
              <option value="in">Money in</option>
            </select>
          </label>
          <label>
            <span>From</span>
            <input
              type="date"
              value={forecast.startDate}
              onChange={(event) => setForecast({ ...forecast, startDate: event.target.value })}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={forecast.endDate}
              onChange={(event) => setForecast({ ...forecast, endDate: event.target.value })}
            />
          </label>
          {forecast.mode === 'random' ? (
            <>
              <label>
                <span>Random rows</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={forecast.randomRowCount}
                  onChange={(event) =>
                    setForecast({ ...forecast, randomRowCount: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Min spend</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={forecast.minSpend}
                  onChange={(event) => setForecast({ ...forecast, minSpend: event.target.value })}
                />
              </label>
              <label>
                <span>Max spend</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={forecast.maxSpend}
                  onChange={(event) => setForecast({ ...forecast, maxSpend: event.target.value })}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                <span>Cadence</span>
                <select
                  value={forecast.cadence}
                  onChange={(event) =>
                    setForecast({ ...forecast, cadence: event.target.value as ForecastCadence })
                  }
                >
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label>
                <span>Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={forecast.amount}
                  onChange={(event) => setForecast({ ...forecast, amount: event.target.value })}
                />
              </label>
              <label>
                <span>Variability %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={forecast.variabilityPercent}
                  onChange={(event) =>
                    setForecast({ ...forecast, variabilityPercent: event.target.value })
                  }
                />
              </label>
            </>
          )}
          <label>
            <span>Seed</span>
            <input
              type="number"
              step="1"
              value={forecast.seed}
              onChange={(event) => setForecast({ ...forecast, seed: event.target.value })}
            />
          </label>
          <button type="submit" className="primary-button">
            Create forecast
          </button>
          {forecastMessage && (
            <span className="merchant-library-status" role="status">
              {forecastMessage}
            </span>
          )}
        </form>
      )}

      <div className="merchant-library-filters" role="group" aria-label="Filter merchants">
        {MERCHANT_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            className={filter === id ? 'is-active' : undefined}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="merchant-library-summary">
        {counts.approved} approved · {counts.review} to review · {counts.personal} flagged private
      </p>

      {isAdding && (
        <form
          className="merchant-library-form"
          aria-label="Add merchant"
          onSubmit={(event) => {
            event.preventDefault()
            if (!draft.displayName.trim()) return
            onCreate(draftToCreate(draft))
            setDraft(EMPTY_DRAFT)
            setIsAdding(false)
          }}
        >
          <label>
            <span>Name</span>
            <input
              required
              value={draft.displayName}
              onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
            />
          </label>
          <label>
            <span>Aliases</span>
            <input
              placeholder="Comma separated"
              value={draft.aliases}
              onChange={(event) => setDraft({ ...draft, aliases: event.target.value })}
            />
          </label>
          <label>
            <span>Category</span>
            <input
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            />
          </label>
          <label>
            <span>Default amount</span>
            <input
              type="number"
              step="0.01"
              value={draft.defaultAmount}
              onChange={(event) => setDraft({ ...draft, defaultAmount: event.target.value })}
            />
          </label>
          <label>
            <span>Cadence</span>
            <select
              value={draft.defaultCadence}
              onChange={(event) => setDraft({ ...draft, defaultCadence: event.target.value })}
            >
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label className="merchant-library-checkbox">
            <input
              type="checkbox"
              checked={draft.recurring}
              onChange={(event) => setDraft({ ...draft, recurring: event.target.checked })}
            />
            Recurring
          </label>
          <label className="merchant-library-checkbox">
            <input
              type="checkbox"
              checked={draft.forecastIncluded}
              onChange={(event) => setDraft({ ...draft, forecastIncluded: event.target.checked })}
            />
            Include in forecasts
          </label>
          <label className="merchant-library-notes">
            <span>Notes</span>
            <textarea
              rows={2}
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
          {duplicate && (
            <p className="merchant-library-duplicate" role="alert">
              {duplicate.canonicalDisplayName} already matches this name.
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  onMergeAlias(duplicate.id, draft.displayName.trim())
                  setDraft(EMPTY_DRAFT)
                  setIsAdding(false)
                }}
              >
                <Merge size={13} aria-hidden="true" /> Merge as alias
              </button>
              or keep both below.
            </p>
          )}
          <div className="merchant-library-form-actions">
            <button type="submit" className="primary-button">
              {duplicate ? 'Keep separate' : 'Add merchant'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setDraft(EMPTY_DRAFT)
                setIsAdding(false)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="merchant-library-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="merchant-library-status" role="status" aria-live="polite">
          {status}
        </p>
      )}

      {isLoading ? (
        <p className="merchant-library-empty">Loading merchant library…</p>
      ) : visible.length === 0 ? (
        <p className="merchant-library-empty">
          {records.length === 0
            ? 'No merchants learned yet. Import a statement or add one manually.'
            : 'No merchants match this filter.'}
        </p>
      ) : (
        <ul className="merchant-library-list">
          {visible.map((record) => {
            const amount = typicalAmount(record)
            const direction = dominantDirection(record)
            const flagged = isLikelyPersonal(record)
            const projectHits = projectId
              ? record.provenance.filter((entry) => entry.projectId === projectId)
              : []
            return (
              <li key={record.id} className={flagged ? 'is-flagged' : undefined}>
                <div className="merchant-library-row">
                  <div className="merchant-library-identity">
                    <strong>{record.canonicalDisplayName}</strong>
                    {record.aliases.length > 0 && (
                      <span className="merchant-library-aliases">{record.aliases.join(', ')}</span>
                    )}
                  </div>
                  <span
                    className={`merchant-library-badge merchant-library-badge--${
                      record.classification === 'excluded'
                        ? 'excluded'
                        : flagged
                          ? 'personal'
                          : isApproved(record)
                            ? 'approved'
                            : 'review'
                    }`}
                  >
                    {record.classification === 'excluded'
                      ? 'Excluded'
                      : flagged
                        ? 'Likely personal'
                        : isApproved(record)
                          ? 'Approved'
                          : 'Review needed'}
                  </span>
                </div>

                <dl className="merchant-library-facts">
                  <div>
                    <dt>Category</dt>
                    <dd>{record.category ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Seen</dt>
                    <dd>{record.occurrenceCount}×</dd>
                  </div>
                  <div>
                    <dt>Last seen</dt>
                    <dd>{formatDate(record.lastSeenAt)}</dd>
                  </div>
                  <div>
                    <dt>Typical</dt>
                    <dd>
                      {typeof amount === 'number'
                        ? `${currencySymbol}${Math.abs(amount).toFixed(2)}`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Direction</dt>
                    <dd>
                      {direction === 'in' ? 'Money in' : direction === 'out' ? 'Money out' : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Cadence</dt>
                    <dd>{record.recurring ? (record.defaultCadence ?? 'Recurring') : 'One-off'}</dd>
                  </div>
                </dl>

                {flagged && (
                  <p className="merchant-library-reasons">
                    <ShieldAlert size={13} aria-hidden="true" />
                    {record.classificationReasons.map((reason) => REASON_LABELS[reason]).join(', ')}
                    . Kept out of forecasts until you approve it.
                  </p>
                )}

                {projectHits.length > 0 && onNavigateToEntry && (
                  <div className="merchant-library-provenance">
                    <span>In this project:</span>
                    {projectHits.slice(0, 5).map((entry) => (
                      <button
                        key={entry.entryId}
                        type="button"
                        className="link-button"
                        onClick={() => onNavigateToEntry(entry.entryId)}
                      >
                        {entry.pageNumber ? `p${entry.pageNumber}` : 'entry'}
                      </button>
                    ))}
                  </div>
                )}

                {editingId === record.id ? (
                  <form
                    className="merchant-library-form"
                    aria-label={`Edit ${record.canonicalDisplayName}`}
                    onSubmit={(event) => {
                      event.preventDefault()
                      const next = draftToCreate(editDraft)
                      onUpdate(record.id, next)
                      setEditingId(null)
                    }}
                  >
                    <label>
                      <span>Name</span>
                      <input
                        value={editDraft.displayName}
                        onChange={(event) =>
                          setEditDraft({ ...editDraft, displayName: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Aliases</span>
                      <input
                        value={editDraft.aliases}
                        onChange={(event) =>
                          setEditDraft({ ...editDraft, aliases: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Category</span>
                      <input
                        value={editDraft.category}
                        onChange={(event) =>
                          setEditDraft({ ...editDraft, category: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Default amount</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editDraft.defaultAmount}
                        onChange={(event) =>
                          setEditDraft({ ...editDraft, defaultAmount: event.target.value })
                        }
                      />
                    </label>
                    <label className="merchant-library-checkbox">
                      <input
                        type="checkbox"
                        checked={editDraft.recurring}
                        onChange={(event) =>
                          setEditDraft({ ...editDraft, recurring: event.target.checked })
                        }
                      />
                      Recurring
                    </label>
                    <label className="merchant-library-notes">
                      <span>Notes</span>
                      <textarea
                        rows={2}
                        value={editDraft.notes}
                        onChange={(event) =>
                          setEditDraft({ ...editDraft, notes: event.target.value })
                        }
                      />
                    </label>
                    <div className="merchant-library-form-actions">
                      <button type="submit" className="primary-button">
                        Save changes
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="merchant-library-actions">
                    {record.classification === 'excluded' ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => onRestore(record.id)}
                      >
                        <Undo2 size={14} aria-hidden="true" /> Restore
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={isApproved(record)}
                          onClick={() => onApprove(record.id)}
                        >
                          <Check size={14} aria-hidden="true" /> Approve
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => onExclude(record.id)}
                        >
                          <X size={14} aria-hidden="true" /> Exclude
                        </button>
                      </>
                    )}
                    <label className="merchant-library-checkbox">
                      <input
                        type="checkbox"
                        checked={record.forecastIncluded}
                        disabled={flagged || record.classification === 'excluded'}
                        onChange={(event) => onToggleForecast(record.id, event.target.checked)}
                      />
                      Forecast
                    </label>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => beginEdit(record)}
                    >
                      <Pencil size={14} aria-hidden="true" /> Edit
                    </button>
                    {confirmForgetId === record.id ? (
                      <span className="merchant-library-confirm" role="alert">
                        Delete merchant data permanently? Project entries are kept.
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => {
                            onForget(record.id)
                            setConfirmForgetId(null)
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setConfirmForgetId(null)}
                        >
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setConfirmForgetId(record.id)}
                      >
                        <Trash2 size={14} aria-hidden="true" /> Forget
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
})
