import React from 'react'
import { useState } from 'react'
import type { ProjectEntry } from '../../../shared/contracts'
import type { KeptEntryPlacement } from '../../../shared/keptEntriesLayout'
import { setKeptEntryDragData } from '../lib/canvasDrop'
import { reorderEntryIds } from '../lib/reorderEntryIds'

interface ExportEntriesPanelProps {
  entries: readonly ProjectEntry[]
  placements: readonly KeptEntryPlacement[]
  onEntryTextChange?: (entryId: string, normalizedText: string) => void
  onReorder?: (entryIds: string[]) => void
  allowCanvasDrag?: boolean
}

export function ExportEntriesPanel({
  entries,
  placements,
  onEntryTextChange,
  onReorder,
  allowCanvasDrag = false
}: ExportEntriesPanelProps): React.JSX.Element {
  const keptEntries = entries.filter((entry) => entry.status === 'keep')
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null)
  const placedEntryIds = new Set(
    placements.flatMap((placement) => (placement.entryId ? [placement.entryId] : []))
  )

  const reorderEntries = (targetEntryId: string): void => {
    if (!draggedEntryId || draggedEntryId === targetEntryId || !onReorder) {
      return
    }

    onReorder(
      reorderEntryIds(
        keptEntries.map((entry) => entry.id),
        draggedEntryId,
        targetEntryId
      )
    )
  }

  return (
    <section className="export-entries-panel" aria-labelledby="export-entries-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">KEPT ENTRIES</span>
          <strong id="export-entries-title">
            {keptEntries.length} entr{keptEntries.length === 1 ? 'y' : 'ies'}
          </strong>
        </div>
      </div>
      <ul className="export-entries-list">
        {keptEntries.map((entry) => (
          <li
            className={`export-entry-item ${placedEntryIds.has(entry.id) ? 'is-placed' : ''}`}
            key={entry.id}
            draggable={Boolean(onReorder) || allowCanvasDrag}
            onDragStart={(event) => {
              setDraggedEntryId(entry.id)
              setKeptEntryDragData(event.dataTransfer, entry.id)
            }}
            onDragEnd={() => setDraggedEntryId(null)}
            onDragOver={(event) => {
              if (onReorder) {
                event.preventDefault()
              }
            }}
            onDrop={(event) => {
              event.preventDefault()
              reorderEntries(entry.id)
              setDraggedEntryId(null)
            }}
          >
            {onEntryTextChange ? (
              <input
                className="export-entry-text"
                aria-label={`Edit kept entry ${entry.id}`}
                value={entry.normalizedText}
                onChange={(event) => onEntryTextChange(entry.id, event.target.value)}
              />
            ) : (
              <span className="export-entry-text">{entry.normalizedText}</span>
            )}
            <span className="export-entry-status">
              {placedEntryIds.has(entry.id) ? 'On canvas' : 'Not placed'}
            </span>
          </li>
        ))}
        {keptEntries.length === 0 && (
          <li className="export-entries-empty">No kept entries to place yet.</li>
        )}
      </ul>
    </section>
  )
}
