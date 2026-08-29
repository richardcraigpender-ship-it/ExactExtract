import React, { useState } from 'react'
import { LENGTH_UNIT_PRECISION, formatLength, resolveLengthCommit } from '../../../shared/units'
import { useLengthUnit } from '../lib/lengthUnitStore'

interface LengthFieldBaseProps {
  label: string
  min?: number
  max?: number
  disabled?: boolean
  id?: string
  placeholder?: string
}

/**
 * Canonical PDF points in and out. Optional fields carry `null` for "not set", which callers use
 * to mean a derived value such as an image's natural size; required fields keep a plain number so
 * they cannot be handed a null.
 */
type LengthFieldProps = LengthFieldBaseProps &
  (
    | { optional?: false; value: number; onChange: (points: number) => void }
    | { optional: true; value: number | null; onChange: (points: number | null) => void }
  )

/** Rejected input returns undefined so the caller can restore the previous text. */
export function LengthField({
  label,
  value,
  onChange,
  min,
  max,
  disabled,
  id,
  optional,
  placeholder
}: LengthFieldProps): React.JSX.Element {
  const unit = useLengthUnit()
  const display = (points: number | null): string =>
    points === null ? '' : formatLength(points, unit)
  const [draft, setDraft] = useState(() => display(value))
  const [shown, setShown] = useState({ value, unit })

  // The committed value and the unit are both external, so the visible text follows them.
  if (shown.value !== value || shown.unit !== unit) {
    setShown({ value, unit })
    setDraft(display(value))
  }

  const commit = (text: string): void => {
    const committed = resolveLengthCommit(text, { unit, optional, min, max })
    if (committed === undefined) {
      setDraft(display(value))
      return
    }
    ;(onChange as (points: number | null) => void)(committed)
    setDraft(display(committed))
  }

  const describedBy = `${id ?? label}-unit`

  return (
    <label className="length-field">
      <span>{`${label} (${unit}${optional ? ', optional' : ''})`}</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        pattern="-?[0-9]*[.,]?[0-9]+[a-zA-Z]*"
        disabled={disabled}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget.value)
        }}
        aria-describedby={describedBy}
      />
      <span className="length-field-unit" id={describedBy} hidden>
        {`Value in ${unit}, to ${LENGTH_UNIT_PRECISION[unit]} decimal places; unit suffixes such as mm or in are accepted${
          optional ? '. Leave empty to derive it automatically' : ''
        }`}
      </span>
    </label>
  )
}
