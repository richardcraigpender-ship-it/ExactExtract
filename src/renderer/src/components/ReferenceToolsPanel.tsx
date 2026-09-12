import React from 'react'
import { Eraser, FileSearch, Redo2, ScanText, Sparkles, Undo2, X } from 'lucide-react'
import { DEFAULT_REFERENCE_PARENT_MAX_SCORE } from '../../../review/references'

export interface ReferenceToolResult {
  action: 'existing' | 'pdf-text' | 'ocr'
  scannedPageCount?: number
  candidateCount?: number
  matchedCandidateCount?: number
  matchedEntryCount?: number
  copiedReferenceCount?: number
  unmatchedCandidateCount?: number
  noSamePageParentCount?: number
  tooFarCandidateCount?: number
  closestUnmatchedScore?: number
  alreadyPresentReferenceCount?: number
}

export type ReferenceToolResults = Partial<
  Record<ReferenceToolResult['action'], ReferenceToolResult>
>

interface ReferenceToolsPanelProps {
  hasKeptEntries: boolean
  hasActiveDocument: boolean
  isScanning: boolean
  isBusy?: boolean
  ocrLanguages: readonly string[]
  status?: string
  results?: ReferenceToolResults
  onCopyExisting: () => void
  onScanPdfText: () => void
  onScanOcr: () => void
  onCancelScan: () => void
  onClearScannedReferences: () => void
  onToggleOcrLanguage: (language: string) => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
}

export const ReferenceToolsPanel = React.memo(function ReferenceToolsPanel({
  hasKeptEntries,
  hasActiveDocument,
  isScanning,
  isBusy = false,
  ocrLanguages,
  status,
  results = {},
  onCopyExisting,
  onScanPdfText,
  onScanOcr,
  onCancelScan,
  onClearScannedReferences,
  onToggleOcrLanguage,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo
}: ReferenceToolsPanelProps): React.JSX.Element {
  const [confirmClear, setConfirmClear] = React.useState(false)
  const scanDisabled =
    isScanning || isBusy || !hasKeptEntries || !hasActiveDocument || ocrLanguages.length === 0
  const methods = [
    ['existing', 'Existing entries'],
    ['pdf-text', 'PDF text'],
    ['ocr', 'OCR source scan']
  ] as const
  const metrics = [
    ['scannedPageCount', 'Pages'],
    ['candidateCount', 'Found'],
    ['matchedCandidateCount', 'Candidates matched'],
    ['matchedEntryCount', 'Kept entries'],
    ['copiedReferenceCount', 'Added'],
    ['unmatchedCandidateCount', 'Unmatched'],
    ['noSamePageParentCount', 'No parent'],
    ['tooFarCandidateCount', 'Too far'],
    ['alreadyPresentReferenceCount', 'Already present']
  ] as const
  return (
    <section className="reference-tools-panel" aria-label="Reference tools">
      <header>
        <div>
          <span className="eyebrow">KEPT ENTRIES ONLY</span>
          <h2>Reference tools</h2>
        </div>
        <p>Try the faster checks first. OCR is for tiny or scanned source text.</p>
      </header>
      <div className="reference-tools-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={!hasKeptEntries || isScanning || isBusy}
          onClick={onCopyExisting}
        >
          <FileSearch size={16} aria-hidden="true" />
          1. Copy entry refs
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={scanDisabled}
          onClick={onScanPdfText}
        >
          <ScanText size={16} aria-hidden="true" />
          2. Scan PDF text refs
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={scanDisabled}
          onClick={onScanOcr}
        >
          <Sparkles size={16} aria-hidden="true" />
          {isScanning ? 'OCR scanning...' : '3. OCR scan source refs'}
        </button>
        {isScanning && (
          <button type="button" className="secondary-button" onClick={onCancelScan}>
            <X size={16} aria-hidden="true" /> Cancel
          </button>
        )}
        {confirmClear ? (
          <span className="reference-tools-confirm" role="alert">
            Remove scanned reference lines from all entry notes? Typed notes are kept.
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                onClearScannedReferences()
                setConfirmClear(false)
              }}
            >
              Confirm
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setConfirmClear(false)}
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="secondary-button"
            disabled={isScanning || isBusy}
            onClick={() => setConfirmClear(true)}
          >
            <Eraser size={16} aria-hidden="true" /> Clear scanned refs
          </button>
        )}
      </div>
      {(onUndo || onRedo) && (
        <div className="reference-tools-history" aria-label="Entry history">
          {onUndo && (
            <button
              type="button"
              className="secondary-button"
              disabled={!canUndo || isScanning || isBusy}
              onClick={onUndo}
            >
              <Undo2 size={16} aria-hidden="true" /> Undo entry change
            </button>
          )}
          {onRedo && (
            <button
              type="button"
              className="secondary-button"
              disabled={!canRedo || isScanning || isBusy}
              onClick={onRedo}
            >
              <Redo2 size={16} aria-hidden="true" /> Redo entry change
            </button>
          )}
        </div>
      )}
      <fieldset className="reference-tools-languages" disabled={isScanning || isBusy}>
        <legend>OCR languages for source re-scan</legend>
        <div>
          {[
            ['eng', 'English'],
            ['spa', 'Spanish'],
            ['fra', 'French'],
            ['deu', 'German']
          ].map(([code, label]) => (
            <label key={code}>
              <input
                type="checkbox"
                checked={ocrLanguages.includes(code)}
                onChange={() => onToggleOcrLanguage(code)}
              />
              {label}
            </label>
          ))}
        </div>
        {ocrLanguages.length === 0 && (
          <p role="alert">Select at least one language before starting an OCR re-scan.</p>
        )}
      </fieldset>
      <section className="reference-tools-results" aria-labelledby="reference-tools-results-title">
        <h3 id="reference-tools-results-title">Results</h3>
        {Object.keys(results).length > 0 ? (
          <div className="reference-tools-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Result</th>
                  {methods.map(([action, label]) => (
                    <th key={action} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map(([metric, label]) => {
                  return (
                    <tr key={metric}>
                      <th scope="row">{label}</th>
                      {methods.map(([action]) => {
                        const value = results[action]?.[metric]
                        return (
                          <td key={action}>
                            {value ?? (metric === 'copiedReferenceCount' ? 0 : '—')}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No scan has run yet.</p>
        )}
        {status && (
          <p className="reference-tools-status" role="status" aria-live="polite">
            {status}
          </p>
        )}
        {results.ocr?.closestUnmatchedScore !== undefined && (
          <p className="reference-tools-status">
            Closest unmatched OCR candidate scored {Math.round(results.ocr.closestUnmatchedScore)}{' '}
            against the matching limit of {DEFAULT_REFERENCE_PARENT_MAX_SCORE}.
          </p>
        )}
      </section>
    </section>
  )
})
