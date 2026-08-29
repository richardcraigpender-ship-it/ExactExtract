import React from 'react'
import { FileText, Plus } from 'lucide-react'

interface SourcePdfDocument {
  path: string
  name: string
  pageCount?: number
}

interface SourcePdfPanelProps {
  documents: readonly SourcePdfDocument[]
  activePath?: string | null
  onSelect: (path: string) => void
  onAddPdfs: () => void
}

export const SourcePdfPanel = React.memo(function SourcePdfPanel({
  documents,
  activePath,
  onSelect,
  onAddPdfs
}: SourcePdfPanelProps): React.JSX.Element {
  return (
    <section className="source-pdf-panel" aria-label="Source PDF">
      <header>
        <div>
          <span className="eyebrow">SOURCE PDF</span>
          <strong>{documents.length === 1 ? '1 document' : `${documents.length} documents`}</strong>
        </div>
        <button type="button" className="icon-button" title="Add PDFs" onClick={onAddPdfs}>
          <Plus size={16} aria-hidden="true" />
          <span className="sr-only">Add PDFs</span>
        </button>
      </header>
      <div className="source-pdf-list">
        {documents.map((document) => (
          <button
            type="button"
            key={document.path}
            className={activePath === document.path ? 'is-active' : ''}
            aria-pressed={activePath === document.path}
            onClick={() => onSelect(document.path)}
          >
            <FileText size={17} aria-hidden="true" />
            <span>{document.name}</span>
            {document.pageCount !== undefined && <small>{document.pageCount} pages</small>}
          </button>
        ))}
        {documents.length === 0 && <p>No source PDFs are loaded.</p>}
      </div>
    </section>
  )
})
