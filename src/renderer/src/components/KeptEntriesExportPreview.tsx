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
}

export function KeptEntriesExportPreview({
  onClose,
  onExport,
  isExporting = false,
  entriesPanel,
  canvas,
  contextPanel,
  onReset
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
          <strong id="kept-entries-preview-title">Kept entries export preview</strong>
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
              aria-label="Close kept entries export preview"
              onClick={onClose}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="kept-entries-preview-body">
          <aside className="kept-entries-preview-entries" aria-label="Kept entries list">
            {entriesPanel}
          </aside>
          <div className="kept-entries-preview-canvas" aria-label="Export layout canvas">
            {canvas}
          </div>
          <aside className="kept-entries-preview-context" aria-label="Layout tools">
            {onReset && (
              <button
                className="secondary-button preview-reset-button"
                type="button"
                onClick={onReset}
              >
                Reset layout
              </button>
            )}
            {contextPanel}
          </aside>
        </div>
      </div>
    </div>
  )
}
