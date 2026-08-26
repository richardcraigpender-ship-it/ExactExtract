import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'

interface RemovePagesPanelProps {
  currentPage: number
  pageCount: number
  isRemoving?: boolean
  status?: string
  onRemovePages: (pages: number[]) => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
}

function parsePageSelection(value: string): number[] {
  const pages = new Set<number>()
  for (const part of value.split(',')) {
    const [startValue, endValue] = part.trim().split('-')
    const start = Number(startValue)
    const end = endValue === undefined ? start : Number(endValue)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) continue
    for (let page = start; page <= end; page += 1) pages.add(page)
  }
  return [...pages].sort((left, right) => left - right)
}

export function RemovePagesPanel({
  currentPage,
  pageCount,
  isRemoving = false,
  status,
  onRemovePages,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo
}: RemovePagesPanelProps): React.JSX.Element {
  const [pageSelection, setPageSelection] = useState(String(currentPage))
  const [pendingPages, setPendingPages] = useState<number[] | null>(null)
  const selectedPages = parsePageSelection(pageSelection)
  // The handler validates against the loaded PDF's real page count; panel metadata can lag it.
  const canRemove = selectedPages.length > 0 && !isRemoving

  return (
    <div className="remove-pages-panel">
      <div className="right-context-heading">
        <div>
          <span className="eyebrow">PAGE MANAGEMENT</span>
          <strong>Remove source pages</strong>
        </div>
        <Trash2 size={18} aria-hidden="true" />
      </div>
      <p className="context-help">
        Remove pages from this project view. The original PDF file on disk is not changed.
      </p>
      <label className="remove-pages-field">
        <span>Pages to remove</span>
        <input
          value={pageSelection}
          onChange={(event) => setPageSelection(event.target.value)}
          placeholder="Example: 3-6, 9"
          aria-describedby="remove-pages-hint"
        />
      </label>
      <small id="remove-pages-hint">
        Use a page number, a range such as 3-6, or comma-separated selections.
      </small>
      <button
        className="secondary-button"
        type="button"
        onClick={() => setPageSelection(String(currentPage))}
      >
        Use current page ({currentPage})
      </button>
      <button
        className="danger-button"
        type="button"
        disabled={!canRemove || isRemoving}
        onClick={() => setPendingPages(selectedPages)}
      >
        <Trash2 size={15} aria-hidden="true" />
        {isRemoving
          ? 'Removing pages...'
          : `Remove ${selectedPages.length || ''} page${selectedPages.length === 1 ? '' : 's'}`}
      </button>
      {(onUndo || onRedo) && (
        <div className="remove-pages-history" aria-label="Page removal history">
          {onUndo && (
            <button type="button" disabled={!canUndo || isRemoving} onClick={onUndo}>
              Undo page removal
            </button>
          )}
          {onRedo && (
            <button type="button" disabled={!canRedo || isRemoving} onClick={onRedo}>
              Redo page removal
            </button>
          )}
        </div>
      )}
      {pendingPages && (
        <section
          className="page-removal-confirmation"
          role="alertdialog"
          aria-label="Confirm page removal"
        >
          <strong>
            Remove {pendingPages.length} page{pendingPages.length === 1 ? '' : 's'} from this
            project view?
          </strong>
          <span>The original PDF file on disk will remain unchanged.</span>
          <div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setPendingPages(null)}
            >
              Cancel
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={isRemoving}
              onClick={() => {
                onRemovePages(pendingPages)
                setPendingPages(null)
              }}
            >
              Confirm removal
            </button>
          </div>
        </section>
      )}
      {status && (
        <p className="page-removal-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
      {selectedPages.length === 0 && pageSelection.trim() && (
        <p className="error-banner" role="alert">
          Enter a valid page number or range from 1 to {pageCount}.
        </p>
      )}
    </div>
  )
}
