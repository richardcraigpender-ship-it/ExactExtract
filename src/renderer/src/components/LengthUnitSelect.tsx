import React from 'react'
import { LENGTH_UNITS, LENGTH_UNIT_LABELS, isLengthUnit } from '../../../shared/units'
import { setLengthUnit, useLengthUnit } from '../lib/lengthUnitStore'

interface LengthUnitSelectProps {
  onChange?: (unit: ReturnType<typeof useLengthUnit>) => void
}

export function LengthUnitSelect({ onChange }: LengthUnitSelectProps = {}): React.JSX.Element {
  const unit = useLengthUnit()

  return (
    <label className="length-unit-select">
      <span>Units</span>
      <select
        aria-label="Coordinate and size units"
        value={unit}
        onChange={(event) => {
          if (!isLengthUnit(event.target.value)) return
          setLengthUnit(event.target.value)
          onChange?.(event.target.value)
        }}
      >
        {LENGTH_UNITS.map((option) => (
          <option key={option} value={option}>
            {`${LENGTH_UNIT_LABELS[option]} (${option})`}
          </option>
        ))}
      </select>
    </label>
  )
}
