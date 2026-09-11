import React from 'react'
import { X } from 'lucide-react'
import { useModalFocusTrap } from './useModalFocusTrap'

interface KeptEntriesExportPreviewProps {
  onClose: () => void
  onExport: () => void
  isExporting?: boolean
  canvas: React.ReactNode
  contextPanel: React.ReactNode
  onReset?: () => void
  title?: string
  /** Current studio mode, rendered as a segmented switch in the header. */
  studioMode?: 'text' | 'png'
  /** Switches the studio to the other mode without closing this window. */
  onSwitchMode?: () => void
}

export function KeptEntriesExportPreview({
  onClose,
  onExport,
  isExporting = false,
  canvas,
  contextPanel,
  onReset,
  title = 'Kept entries export preview',
  studioMode,
  onSwitchMode
}: KeptEntriesExportPreviewProps): React.JSX.Element {
  const { dialogRef, onKeyDown: trapFocus } = useModalFocusTrap<HTMLDivElement>()

  return (
    <div className="kept-entries-preview-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className={
          studioMode === 'text'
            ? 'kept-entries-preview kept-entries-preview--text-template'
            : 'kept-entries-preview'
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="kept-entries-preview-title"
        onClick={(event) => event.stopPropagation()}
          onKeyDown={trapFocus}
      >
        <header className="kept-entries-preview-header">
          <strong id="kept-entries-preview-title">{title}</strong>
          {studioMode && (
            <div className="kept-canvas-mode-switch" role="group" aria-label="Canvas mode">
              <button
                type="button"
                className={studioMode === 'text' ? 'mode-button is-active' : 'mode-button'}
                aria-pressed={studioMode === 'text'}
                disabled={studioMode === 'text' || !onSwitchMode}
                onClick={onSwitchMode}
              >
                Formatted Text Statement
              </button>
              <button
                type="button"
                className={studioMode === 'png' ? 'mode-button is-active' : 'mode-button'}
                aria-pressed={studioMode === 'png'}
                disabled={studioMode === 'png' || !onSwitchMode}
                onClick={onSwitchMode}
              >
                PNG Snippet Board
              </button>
            </div>
          )}
          <div className="kept-entries-preview-actions">
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
        </div>
      </div>
    </div>
  )
}
