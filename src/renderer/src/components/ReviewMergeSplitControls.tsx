import React from 'react'
import { useState } from 'react'
import { Merge, Split, X } from 'lucide-react'
import type { ProjectEntry } from '../../../shared/contracts'
import { parseSplitParts } from '../../../review/operations'

interface ReviewMergeSplitControlsProps {
  selectedEntries: ProjectEntry[]
  primaryEntry?: ProjectEntry
  onMerge: () => void
  onSplit: (entryId: string, parts: string[]) => void
}

export function ReviewMergeSplitControls({
  selectedEntries,
  primaryEntry,
  onMerge,
  onSplit
}: ReviewMergeSplitControlsProps): React.JSX.Element {
  const [splitEntry, setSplitEntry] = useState<ProjectEntry | null>(null)
  const [partsText, setPartsText] = useState('')
  const selectedEntry =
    selectedEntries.length === 1
      ? selectedEntries[0]
      : selectedEntries.length === 0
        ? primaryEntry
        : undefined
  const activeSplitEntry =
    splitEntry &&
    (selectedEntries.some((entry) => entry.id === splitEntry.id) ||
      primaryEntry?.id === splitEntry.id)
      ? splitEntry
      : null
  const sameStatus =
    selectedEntries.length > 1 &&
    selectedEntries.every((entry) => entry.status === selectedEntries[0]?.status)

  const openSplit = (): void => {
    if (!selectedEntry) return
    setSplitEntry(selectedEntry)
    setPartsText(parseSplitParts(selectedEntry.normalizedText).join('\n'))
  }

  const parts = parseSplitParts(partsText)
  const duplicateParts =
    new Set(parts.map((part) => part.toLocaleLowerCase())).size !== parts.length
  const validationMessage =
    parts.length < 2
      ? 'Add at least two parts, separated by a new line, semicolon, or vertical bar.'
      : duplicateParts
        ? 'Each resulting entry must be unique.'
        : `${parts.length} entries will replace the selected entry.`

  return (
    <>
      <div className="review-structure-actions" aria-label="Merge and split entries">
        <button
          className="secondary-button"
          type="button"
          disabled={!sameStatus}
          title={sameStatus ? 'Merge selected entries' : 'Select entries with the same decision'}
          onClick={(event) => {
            event.stopPropagation()
            if (sameStatus) {
              onMerge()
            }
          }}
        >
          <Merge size={15} /> Merge
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!selectedEntry}
          onClick={(event) => {
            event.stopPropagation()
            if (selectedEntry) {
              openSplit()
            }
          }}
        >
          <Split size={15} /> Split
        </button>
      </div>
      {activeSplitEntry && (
        <aside className="entry-editor" aria-label="Split reviewed entry">
          <div className="entry-editor-header">
            <div>
              <span className="eyebrow">SPLIT ENTRY</span>
              <strong>One resulting entry per line</strong>
            </div>
            <button
              className="icon-button"
              type="button"
              title="Close split editor"
              onClick={(event) => {
                event.stopPropagation()
                setSplitEntry(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.stopPropagation()
                }
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div className="entry-editor-body">
            <label>
              <span>Entry parts</span>
              <textarea
                aria-describedby="split-entry-guidance"
                value={partsText}
                rows={6}
                onChange={(event) => setPartsText(event.target.value)}
              />
              <small id="split-entry-guidance" role="status">
                {validationMessage}
              </small>
            </label>
          </div>
          <div className="entry-editor-footer">
            <button
              className="secondary-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setSplitEntry(null)
              }}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={parts.length < 2 || duplicateParts}
              onClick={(event) => {
                event.stopPropagation()
                onSplit(activeSplitEntry.id, parts)
                setSplitEntry(null)
              }}
            >
              <Split size={15} /> Create {parts.length} entries
            </button>
          </div>
        </aside>
      )}
    </>
  )
}
