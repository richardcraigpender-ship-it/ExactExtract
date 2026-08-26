import React from 'react'

interface PagePreviewStripProps {
  pageCount: number
  currentPage: number
  onSelectPage: (pageNumber: number) => void
  renderThumbnail?: (pageNumber: number) => React.ReactNode
}

export function PagePreviewStrip({
  pageCount,
  currentPage,
  onSelectPage,
  renderThumbnail
}: PagePreviewStripProps): React.JSX.Element {
  const pages = Array.from({ length: Math.max(0, pageCount) }, (_, index) => index + 1)

  return (
    <section className="page-preview-panel" aria-label="Page previewer">
      <header>
        <strong>Pages</strong>
        <span>{pageCount}</span>
      </header>
      <div className="page-preview-strip">
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            aria-label={`Go to page ${pageNumber}`}
            aria-current={currentPage === pageNumber ? 'page' : undefined}
            onClick={(event) => {
              event.stopPropagation()
              onSelectPage(pageNumber)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation()
              }
            }}
          >
            <span className="page-preview-thumbnail" aria-hidden="true">
              {renderThumbnail?.(pageNumber) ?? pageNumber}
            </span>
            <span>Page {pageNumber}</span>
          </button>
        ))}
        {pages.length === 0 && <p>No pages available.</p>}
      </div>
    </section>
  )
}
