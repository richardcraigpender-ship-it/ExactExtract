import React, { useState } from 'react'

import {
  describeHighlightScope,
  type HighlightGeometryField,
  type HighlightMeasurement,
  type HighlightScope,
  type HighlightStyleMode
} from '../lib/highlightGeometry'
import { LENGTH_UNIT_STEP, formatLength, type LengthUnit } from '../../../shared/units'
import { useLengthUnit } from '../lib/lengthUnitStore'
import { LengthUnitSelect } from './LengthUnitSelect'

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
  measurements?: HighlightMeasurement | null
  lastResult?: string | null
  onChangeVisible: (visible: boolean) => void
  onChangeEditMode: (editMode: boolean) => void
  onChangeStyleMode: (styleMode: HighlightStyleMode) => void
  onChangeScope: (scope: HighlightScope) => void
  onApply: (
    field: HighlightGeometryField,
    mode: 'absolute' | 'delta',
    value: number,
    unit: LengthUnit
  ) => void
}

function parseValue(raw: string): number | null {
  if (raw.trim() === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
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
  const unit = useLengthUnit()
  const [rawValue, setRawValue] = useState('0')

  const parsed = parseValue(rawValue)
  // The engine clamps to the page, so only clearly nonsensical input is rejected here.
  const negativeAbsolute = parsed !== null && mode === 'absolute' && parsed < 0
  const missingPageSize = measurements?.status === 'no-page-size'
  const invalid = parsed === null || negativeAbsolute
  const canApply = !invalid && !missingPageSize && affectedCount > 0

  const validationMessage = missingPageSize
    ? 'This page has no recorded size, so highlights on it can only be adjusted by dragging.'
    : parsed === null
      ? 'Enter a number.'
      : negativeAbsolute
        ? `Enter a value of 0 ${unit} or more.`
        : null

  const apply = (): void => {
    if (!canApply || parsed === null) return
    onApply(field, mode, parsed, unit)
  }

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

        {measurements?.status === 'measured' ? (
          <table className="highlight-tool-measurements">
            <caption>Selected highlight</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Property</span>
                </th>
                <th scope="col">{unit}</th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(({ id, label }) => (
                <tr key={id}>
                  <th scope="row">{label}</th>
                  <td>{formatLength(measurements[id], unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : missingPageSize ? (
          <p className="highlight-tool-hint">
            This page has no recorded size, so its highlights cannot be measured or set numerically.
            Drag or resize them on the page instead.
          </p>
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
        <LengthUnitSelect />
        <label>
          <span>Value ({unit})</span>
          <input
            type="number"
            value={rawValue}
            step={LENGTH_UNIT_STEP[unit]}
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
