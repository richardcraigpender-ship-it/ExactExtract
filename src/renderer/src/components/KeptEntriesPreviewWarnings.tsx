import React from 'react'
import type { ProjectEntry } from '../../../shared/contracts'
import { getKeptEntriesCanvasWarnings, type KeptEntriesCanvasWarning } from '../../../export'
import type { KeptEntriesCanvasLayout } from '../../../shared/keptEntriesLayout'

interface KeptEntriesPreviewWarningsProps {
  entries: readonly ProjectEntry[]
  layout: KeptEntriesCanvasLayout
}

function warningLabel(warning: KeptEntriesCanvasWarning): string {
  switch (warning.code) {
    case 'empty-layout':
      return 'No kept entries are placed on the canvas.'
    case 'missing-entry':
      return `Placement ${warning.placementId} is not linked to a current kept entry.`
    case 'out-of-bounds':
      return `Placement ${warning.placementId} extends beyond the page bounds.`
    case 'overflow':
      return `Placement ${warning.placementId} may overflow its text box.`
    case 'missing-background':
      return 'The background image could not be decoded and will be skipped.'
    case 'system-font-fallback':
      return `System font "${warning.fontFamily}" will fall back to Helvetica unless its bytes are supplied.`
  }
}

export function KeptEntriesPreviewWarnings({
  entries,
  layout
}: KeptEntriesPreviewWarningsProps): React.JSX.Element | null {
  const warnings = getKeptEntriesCanvasWarnings(entries, layout)
  if (warnings.length === 0) return null

  return (
    <section className="kept-entries-preview-warnings" aria-label="Preview warnings">
      <strong>Review before export</strong>
      <ul>
        {warnings.map((warning) => (
          <li key={`${warning.code}-${warning.placementId ?? warning.fontFamily ?? 'layout'}`}>
            {warningLabel(warning)}
          </li>
        ))}
      </ul>
    </section>
  )
}
