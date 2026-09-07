import React from 'react'
import { X } from 'lucide-react'
import { useModalFocusTrap } from './useModalFocusTrap'

interface KeptEntriesExportPreviewProps {
  onClose: () => void
  onExport: () => void
  isExporting?: boolean
  entriesPanel: React.ReactNode
  canvas: React.ReactNode
  contextPanel: React.ReactNode
  onReset?: () => void
  title?: string
  entriesLabel?: string
}

export function KeptEntriesExportPreview({
  onClose,
  onExport,
  isExporting = false,
  entriesPanel,
  canvas,
  contextPanel,
  onReset,
  title = 'Kept entries export preview',
  entriesLabel = 'Kept entries list'
}: KeptEntriesExportPreviewProps): React.JSX.Element {
  const { dialogRef, onKeyDown: trapFocus } = useModalFocusTrap<HTMLDivElement>()

  return (
    <div className="kept-entries-preview-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="kept-entries-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kept-entries-preview-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
          else trapFocus(event)
        }}
      >
        <header className="kept-entries-preview-header">
          <strong id="kept-entries-preview-title">{title}</strong>
          <div className="kept-entries-preview-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={isExporting}
              onClick={onExport}
            >
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              className="icon-button"
              type="button"
              title="Close preview"
              aria-label={`Close ${title.toLowerCase()}`}
              onClick={onClose}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="kept-entries-preview-body">
          <aside className="kept-entries-preview-context" aria-label="Layout tools">
            <div className="kept-entries-preview-tool-stack">
              {onReset && (
                <button
                  className="secondary-button preview-tool-button preview-reset-button"
                  type="button"
                  onClick={onReset}
                >
                  Reset layout
                </button>
              )}
              {contextPanel}
            </div>
          </aside>
          <div className="kept-entries-preview-canvas" aria-label="Export layout canvas">
            {canvas}
          </div>
          <aside className="kept-entries-preview-entries" aria-label={entriesLabel}>
            {entriesPanel}
          </aside>
        </div>
      </div>
    </div>
  )
}
