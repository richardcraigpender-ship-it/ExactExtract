import React, { memo, useEffect, useMemo, useState } from 'react'
import { Document, Page } from 'react-pdf'
import '../lib/pdf'

/** Fixed render width in CSS pixels. */
export const PAGE_THUMBNAIL_WIDTH = 96

/**
 * Fallback page shape (width / height, ISO A4 portrait) used only when nothing better is known.
 *
 * Real projects mix orientations - the bundled fixtures contain both portrait and landscape pages -
 * so no single constant fits every page. Callers that already know a page's shape should pass
 * `aspectRatio`; otherwise the first sibling page to render seeds the shape for the rest.
 */
export const PAGE_THUMBNAIL_ASPECT_RATIO = 0.707

/**
 * Last observed page shape per document, keyed by identity of the byte array.
 *
 * Pages within one document are usually the same shape, so the first page to finish rendering gives
 * its siblings a far better placeholder than the portrait default and stops the strip reflowing as
 * each thumbnail arrives. A WeakMap keeps this from retaining PDF bytes after the document closes.
 */
const documentShapes = new WeakMap<Uint8Array, number>()

export interface PageThumbnailProps {
  /** Raw bytes of the active PDF, or null when no document is loaded. */
  data: Uint8Array | null
  pageNumber: number
  /** Render width in CSS pixels. Defaults to {@link PAGE_THUMBNAIL_WIDTH}. */
  width?: number
  /** Known page aspect ratio (width / height), used to reserve space before the page loads. */
  aspectRatio?: number
}

type ThumbnailState = 'loading' | 'ready' | 'error' | 'empty'

/**
 * Compact single-page preview.
 *
 * Text and annotation layers stay off: this is a picture, not a viewer, so the strip must not
 * instantiate selectable text or link targets. The page number stays visible in every state, and
 * the wrapper reserves its box up front so a slow render cannot resize the Pages panel.
 */
export const PageThumbnail = memo(function PageThumbnail({
  data,
  pageNumber,
  width = PAGE_THUMBNAIL_WIDTH,
  aspectRatio
}: PageThumbnailProps): React.JSX.Element {
  const [state, setState] = useState<ThumbnailState>('loading')
  const [measuredRatio, setMeasuredRatio] = useState<number | null>(null)

  // A new document or page invalidates whatever was previously rendered.
  useEffect(() => {
    setState('loading')
    setMeasuredRatio(null)
  }, [data, pageNumber])

  const file = useMemo(() => (data && data.length > 0 ? { data } : null), [data])
  const knownShape = data ? documentShapes.get(data) : undefined
  const shape = measuredRatio ?? aspectRatio ?? knownShape ?? PAGE_THUMBNAIL_ASPECT_RATIO

  if (!file) {
    return (
      <div className="page-thumbnail" style={{ width, aspectRatio: shape }} data-state="empty">
        <div className="page-thumbnail-label">{pageNumber}</div>
      </div>
    )
  }

  return (
    <div
      className="page-thumbnail"
      style={{ width, aspectRatio: shape }}
      data-state={state}
      data-page={pageNumber}
    >
      <div className="page-thumbnail-label">{pageNumber}</div>
      <Document
        file={file}
        loading={<></>}
        error={<></>}
        noData={<></>}
        onLoadError={() => setState('error')}
      >
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={<></>}
          error={<></>}
          onLoadSuccess={({ originalWidth, originalHeight }) => {
            if (originalWidth > 0 && originalHeight > 0) {
              const ratio = originalWidth / originalHeight
              setMeasuredRatio(ratio)
              if (data) documentShapes.set(data, ratio)
            }
          }}
          onRenderSuccess={() => setState('ready')}
          onRenderError={() => setState('error')}
        />
      </Document>
    </div>
  )
})
