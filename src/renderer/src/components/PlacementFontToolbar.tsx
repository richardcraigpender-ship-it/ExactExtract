import React from 'react'

import type { KeptEntryPlacement } from '../../../shared/keptEntriesLayout'
import { FontPicker } from './FontPicker'

interface PlacementFontToolbarProps {
  placement: KeptEntryPlacement | null
  onChange: (placement: KeptEntryPlacement) => void
  applyToAll?: boolean
  onApplyToAllChange?: (value: boolean) => void
}

const STANDARD_FONTS = ['Helvetica', 'Helvetica-Bold', 'Times-Roman', 'Courier'] as const

export function PlacementFontToolbar({
  placement,
  onChange,
  applyToAll = false,
  onApplyToAllChange
}: PlacementFontToolbarProps): React.JSX.Element {
  if (!placement) {
    return <p className="placement-font-toolbar-empty">Select a text box to format it.</p>
  }

  return (
    <section className="placement-font-toolbar" aria-label="Selected text formatting">
      {onApplyToAllChange && (
        <label className="placement-font-toolbar-all">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(event) => onApplyToAllChange(event.target.checked)}
          />
          <span>Change all entries</span>
        </label>
      )}
      <label>
        <span>PDF font</span>
        <select
          value={placement.fontRef.kind === 'standard-14' ? placement.fontRef.family : ''}
          onChange={(event) => {
            const family = event.target.value as (typeof STANDARD_FONTS)[number]
            if (!family) return
            onChange({ ...placement, fontRef: { kind: 'standard-14', family } })
          }}
        >
          {placement.fontRef.kind === 'system' && <option value="">System font</option>}
          {STANDARD_FONTS.map((font) => (
            <option value={font} key={font}>
              {font}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Size</span>
        <input
          type="number"
          min="6"
          max="96"
          step="1"
          value={placement.fontSize}
          onChange={(event) =>
            onChange({
              ...placement,
              fontSize: Math.max(6, Math.min(96, Number(event.target.value) || 6))
            })
          }
        />
      </label>
      <label>
        <span>Color</span>
        <input
          type="color"
          value={placement.color}
          onChange={(event) => onChange({ ...placement, color: event.target.value })}
        />
      </label>
      <label>
        <span>Rotation</span>
        <input
          type="number"
          min="-180"
          max="180"
          step="1"
          value={placement.rotation}
          onChange={(event) =>
            onChange({
              ...placement,
              rotation: Math.max(-180, Math.min(180, Number(event.target.value) || 0))
            })
          }
        />
      </label>
      <FontPicker
        value={null}
        onChange={(selection) =>
          onChange({
            ...placement,
            fontRef: { kind: 'system', family: selection.family, style: selection.style }
          })
        }
      />
    </section>
  )
}
