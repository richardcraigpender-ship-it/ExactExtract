import React from 'react'
import { FileSearch, ScanText, X } from 'lucide-react'

interface ReviewReferenceToolsProps {
  hasKeptEntries: boolean
  hasActiveDocument: boolean
  isScanning: boolean
  isBusy?: boolean
  status?: string
  onCopyKeptReferences: () => void
  onScanSourceReferences: () => void
  onCancelScan: () => void
}

export function ReviewReferenceTools({
  hasKeptEntries,
  hasActiveDocument,
  isScanning,
  isBusy = false,
  status,
  onCopyKeptReferences,
  onScanSourceReferences,
  onCancelScan
}: ReviewReferenceToolsProps): React.JSX.Element {
  return (
    <section className="review-reference-tools" aria-label="OCR reference re-scan">
      <div className="review-reference-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={!hasKeptEntries || isScanning || isBusy}
          onClick={onCopyKeptReferences}
        >
          <FileSearch size={14} aria-hidden="true" /> Copy refs to notes
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={isScanning || isBusy || !hasActiveDocument || !hasKeptEntries}
          onClick={onScanSourceReferences}
        >
          <ScanText size={14} aria-hidden="true" />
          {isScanning ? 'OCR scanning refs...' : 'OCR scan source refs'}
        </button>
        {isScanning && (
          <button className="secondary-button" type="button" onClick={onCancelScan}>
            <X size={14} aria-hidden="true" /> Cancel re-scan
          </button>
        )}
      </div>
      {status && (
        <span className="review-reference-status" role="status" aria-live="polite">
          {status}
        </span>
      )}
    </section>
  )
}
