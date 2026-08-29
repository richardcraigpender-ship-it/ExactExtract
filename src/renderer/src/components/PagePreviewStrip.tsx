import React from 'react'

export interface PageReviewCounts {
  keep: number
  maybe: number
  exclude: number
}

interface PagePreviewStripProps {
  pageCount: number
  currentPage: number
  onSelectPage: (pageNumber: number) => void
  renderThumbnail?: (pageNumber: number) => React.ReactNode
  pageReviewCounts?: ReadonlyMap<number, PageReviewCounts>
}

export function PagePreviewStrip({
  pageCount,
  currentPage,
  onSelectPage,
  renderThumbnail,
  pageReviewCounts
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
          (() => {
            const counts = pageReviewCounts?.get(pageNumber) ?? { keep: 0, maybe: 0, exclude: 0 }
            return (
              <button
                key={pageNumber}
                type="button"
                aria-label={`Go to page ${pageNumber}`}
                aria-description={`${counts.keep} kept, ${counts.maybe} maybe, ${counts.exclude} excluded`}
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
                <div
                  className={
                    renderThumbnail ? 'page-preview-thumbnail is-rendered' : 'page-preview-thumbnail'
                  }
                  aria-hidden="true"
                >
                  {renderThumbnail?.(pageNumber) ?? pageNumber}
                </div>
                <span>Page {pageNumber}</span>
                <span className="page-preview-counts" aria-hidden="true">
                  <span className="page-preview-count page-preview-count-keep">K: {counts.keep}</span>
                  <span className="page-preview-count page-preview-count-maybe">M: {counts.maybe}</span>
                  <span className="page-preview-count page-preview-count-exclude">X: {counts.exclude}</span>
                </span>
              </button>
            )
          })()
        ))}
        {pages.length === 0 && <p>No pages available.</p>}
      </div>
    </section>
  )
}
