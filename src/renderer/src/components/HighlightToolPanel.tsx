import React, { useState } from 'react'

import {
  describeHighlightScope,
  type HighlightGeometryField,
  type HighlightMeasurements,
  type HighlightScope,
  type HighlightStyleMode,
  type HighlightUnit
} from '../lib/highlightGeometry'

const FIELDS: { id: HighlightGeometryField; label: string }[] = [
  { id: 'x', label: 'X' },
  { id: 'y', label: 'Y' },
  { id: 'width', label: 'Width' },
  { id: 'height', label: 'Height' }
]

const SCOPES: { id: HighlightScope; label: string }[] = [
  { id: 'entry', label: 'Selected entry' },
  { id: 'selected', label: 'Checked entries' },
  { id: 'keep', label: 'All keep entries' },
  { id: 'all', label: 'All on page' }
]

export interface HighlightToolPanelProps {
  visible: boolean
  editMode: boolean
  styleMode: HighlightStyleMode
  scope: HighlightScope
  affectedCount: number
  measurements?: HighlightMeasurements | null
  lastResult?: string | null
  onChangeVisible: (visible: boolean) => void
  onChangeEditMode: (editMode: boolean) => void
  onChangeStyleMode: (styleMode: HighlightStyleMode) => void
  onChangeScope: (scope: HighlightScope) => void
  onApply: (
    field: HighlightGeometryField,
    mode: 'absolute' | 'delta',
    value: number,
    unit: HighlightUnit
  ) => void
}

function parseValue(raw: string): number | null {
  if (raw.trim() === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function formatNumber(value: number): string {
  return Math.round(value * 10) / 10 === Math.round(value)
    ? String(Math.round(value))
    : value.toFixed(1)
}

export function HighlightToolPanel({
  visible,
  editMode,
  styleMode,
  scope,
  affectedCount,
  measurements,
  lastResult,
  onChangeVisible,
  onChangeEditMode,
  onChangeStyleMode,
  onChangeScope,
  onApply
}: HighlightToolPanelProps): React.JSX.Element {
  const [field, setField] = useState<HighlightGeometryField>('x')
  const [mode, setMode] = useState<'absolute' | 'delta'>('absolute')
  const [unit, setUnit] = useState<HighlightUnit>('percent')
  const [rawValue, setRawValue] = useState('0')

  const parsed = parseValue(rawValue)
  // Percent values are bounded by the page; point values are bounded by the page size,
  // which the engine clamps, so only reject clearly nonsensical input here.
  const outOfRange =
    parsed !== null &&
    unit === 'percent' &&
    (mode === 'absolute' ? parsed < 0 || parsed > 100 : parsed < -100 || parsed > 100)
  const negativeAbsolutePoints =
    parsed !== null && unit === 'points' && mode === 'absolute' && parsed < 0
  const invalid = parsed === null || outOfRange || negativeAbsolutePoints
  const canApply = !invalid && affectedCount > 0

  const validationMessage =
    parsed === null
      ? 'Enter a number.'
      : outOfRange
        ? mode === 'absolute'
          ? 'Enter a percentage between 0 and 100.'
          : 'Enter an offset between -100 and 100.'
        : negativeAbsolutePoints
          ? 'Enter a point value of 0 or more.'
          : null

  const apply = (): void => {
    if (!canApply || parsed === null) return
    onApply(field, mode, unit === 'percent' ? parsed / 100 : parsed, unit)
  }

  const unitLabel = unit === 'percent' ? '% of page' : 'pt'

  return (
    <div className="highlight-tool-panel">
      <fieldset className="highlight-tool-group">
        <legend>Display</legend>
        <label className="highlight-tool-check">
          <input
            type="checkbox"
            checked={visible}
            onChange={(event) => onChangeVisible(event.target.checked)}
          />
          <span>Show highlights</span>
        </label>
        <label className="highlight-tool-check">
          <input
            type="checkbox"
            checked={editMode}
            disabled={!visible}
            onChange={(event) => onChangeEditMode(event.target.checked)}
          />
          <span>Enable drag and resize</span>
        </label>
        <label>
          <span>Style</span>
          <select
            value={styleMode}
            disabled={!visible}
            onChange={(event) => onChangeStyleMode(event.target.value as HighlightStyleMode)}
          >
            <option value="filled">Filled</option>
            <option value="border">Border only</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="highlight-tool-group">
        <legend>Position and size</legend>

        {measurements ? (
          <table className="highlight-tool-measurements">
            <caption>Selected highlight</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Property</span>
                </th>
                <th scope="col">% of page</th>
                <th scope="col">PDF points</th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(({ id, label }) => (
                <tr key={id}>
                  <th scope="row">{label}</th>
                  <td>{formatNumber(measurements.percent[id])}</td>
                  <td>{measurements.points ? formatNumber(measurements.points[id]) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="highlight-tool-hint">
            Select an entry with a highlight to see its current position.
          </p>
        )}

        <label>
          <span>Apply to</span>
          <select
            value={scope}
            onChange={(event) => onChangeScope(event.target.value as HighlightScope)}
          >
            {SCOPES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="highlight-tool-hint">
          {scope === 'keep'
            ? 'Keep entries are matched across the whole document.'
            : 'Only highlights on the page in view are affected.'}
        </p>
        <label>
          <span>Property</span>
          <select
            value={field}
            onChange={(event) => setField(event.target.value as HighlightGeometryField)}
          >
            {FIELDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Change</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as 'absolute' | 'delta')}
          >
            <option value="absolute">Set to</option>
            <option value="delta">Adjust by</option>
          </select>
        </label>
        <label>
          <span>Units</span>
          <select value={unit} onChange={(event) => setUnit(event.target.value as HighlightUnit)}>
            <option value="percent">Percent of page</option>
            <option value="points">PDF points</option>
          </select>
        </label>
        <label>
          <span>Value ({unitLabel})</span>
          <input
            type="number"
            value={rawValue}
            step={unit === 'percent' ? 1 : 5}
            aria-invalid={invalid || undefined}
            aria-describedby="highlight-tool-validation"
            onChange={(event) => setRawValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              apply()
            }}
          />
        </label>

        <p className="highlight-tool-hint" id="highlight-tool-validation">
          {validationMessage ?? describeHighlightScope(affectedCount)}
        </p>

        <button className="primary-button" type="button" disabled={!canApply} onClick={apply}>
          Apply
        </button>
      </fieldset>

      <p className="highlight-tool-status" role="status" aria-live="polite" aria-atomic="true">
        {lastResult ?? ''}
      </p>
    </div>
  )
}
