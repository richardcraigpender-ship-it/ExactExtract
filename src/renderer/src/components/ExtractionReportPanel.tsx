import React from 'react'
import { AlertTriangle } from 'lucide-react'
import type { ExtractionDocumentReport } from '../../../review'

export interface ExtractionReportDocumentSummary {
  documentId: string
  documentName: string
  report: ExtractionDocumentReport
}

export type ExtractionReportFilterReason = 'excluded' | 'maybe' | 'ocr'

interface ExtractionReportPanelProps {
  summaries: readonly ExtractionReportDocumentSummary[]
  onNavigateToPage: (documentId: string, pageNumber: number) => void
  onFilterByReason: (reason: ExtractionReportFilterReason) => void
}

const ATTENTION_LABELS: Record<
  ExtractionDocumentReport['attentionPages'][number]['reasons'][number],
  string
> = {
  'ocr-recommended': 'OCR',
  'low-confidence': 'Low confidence',
  'review-issue': 'Review issue'
}

export function ExtractionReportPanel({
  summaries,
  onNavigateToPage,
  onFilterByReason
}: ExtractionReportPanelProps): React.JSX.Element {
  if (summaries.length === 0) {
    return (
      <section className="extraction-report-panel" aria-label="Extraction report">
        <p className="extraction-report-empty">
          Run extraction to see a per-document quality summary here.
        </p>
      </section>
    )
  }

  return (
    <section className="extraction-report-panel" aria-label="Extraction report">
      {summaries.map(({ documentId, documentName, report }) => (
        <article className="extraction-report-card" key={documentId}>
          <header>
            <strong>{documentName}</strong>
            <span className="status-pill">{report.pageCount} pages</span>
          </header>
          <dl className="extraction-report-facts">
            <div>
              <dt>Digital</dt>
              <dd>{report.digitalPageCount}</dd>
            </div>
            <div>
              <dt>Scanned</dt>
              <dd>{report.scannedPageCount}</dd>
            </div>
            <div>
              <dt>Mixed</dt>
              <dd>{report.mixedPageCount}</dd>
            </div>
            <div>
              <dt>OCR pages</dt>
              <dd>{report.ocrPageCount}</dd>
            </div>
          </dl>
          {report.ocrLanguages.length > 0 && (
            <p className="extraction-report-languages">OCR languages: {report.ocrLanguages.join(', ')}</p>
          )}
          <div className="extraction-report-rows">
            <button type="button" onClick={() => onFilterByReason('excluded')}>
              {report.excludedRowCount} excluded
            </button>
            <button type="button" onClick={() => onFilterByReason('maybe')}>
              {report.maybeRowCount} maybe
            </button>
            <button type="button" onClick={() => onFilterByReason('ocr')}>
              {report.ocrPageCount > 0 ? report.ocrPageCount : 0} OCR-derived
            </button>
            {report.mergedRowCount > 0 && <span>{report.mergedRowCount} merged</span>}
          </div>
          <p className="extraction-report-confidence">
            Confidence · high {report.confidenceDistribution.high} · medium{' '}
            {report.confidenceDistribution.medium} · low {report.confidenceDistribution.low}
          </p>
          {report.attentionPages.length > 0 && (
            <div className="extraction-report-attention">
              <span>Needs attention:</span>
              {report.attentionPages.map((page) => (
                <button
                  type="button"
                  key={page.pageNumber}
                  title={page.reasons.map((reason) => ATTENTION_LABELS[reason]).join(', ')}
                  onClick={() => onNavigateToPage(documentId, page.pageNumber)}
                >
                  <AlertTriangle size={12} aria-hidden="true" />p{page.pageNumber}
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
    </section>
  )
}
