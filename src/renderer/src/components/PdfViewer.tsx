import {
  forwardRef,
  memo,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileWarning,
  RotateCw,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import '../lib/pdf'
import {
  describeViewerHighlight,
  describeViewerHighlightCount,
  projectViewerRegion,
  type NormalizedViewerRegion,
  type ViewerHighlight,
  type ViewerRotation,
  unprojectViewerRegion
} from './viewerAccessibility'

export type { ViewerHighlight } from './viewerAccessibility'

export interface PdfViewerHandle {
  toggleOverlay: () => void
  zoomIn: () => void
  zoomOut: () => void
}

interface PdfViewerProps {
  data: Uint8Array | null
  fileName: string
  initialZoom?: number
  highlight?: ViewerHighlight
  highlights?: ViewerHighlight[]
  requestedPage?: number
  highlightsVisible?: boolean
  highlightEditMode?: boolean
  highlightStyleMode?: 'filled' | 'border'
  onPageChange?: (page: number) => void
  onSelectHighlight?: (entryId: string) => void
  onChangeHighlight?: (entryId: string, regionIndex: number, region: NormalizedViewerRegion) => void
  onToggleHighlights?: () => void
}

export const PdfViewer = memo(
  forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
    {
      data,
      fileName,
      initialZoom = 1,
      highlight,
      highlights = [],
      requestedPage,
      highlightsVisible,
      highlightEditMode = true,
      highlightStyleMode = 'filled',
      onPageChange,
      onSelectHighlight,
      onChangeHighlight,
      onToggleHighlights
    },
    ref
  ) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const highlightDescriptionId = useId()
    const highlightCountId = useId()
    const [pageCount, setPageCount] = useState(0)
    const [pageNumber, setPageNumber] = useState(1)
    const [rotation, setRotation] = useState<ViewerRotation>(0)
    const [zoom, setZoom] = useState(() => Math.min(2, Math.max(0.6, initialZoom)))
    const [availableWidth, setAvailableWidth] = useState(700)
    const [pageAspectRatio, setPageAspectRatio] = useState(8.5 / 11)
    const [internalOverlayVisible, setInternalOverlayVisible] = useState(true)
    // The tool panel owns visibility when it supplies a value; otherwise the viewer keeps its
    // own toggle so the component stays usable standalone (and in existing tests).
    const showStatusOverlay = highlightsVisible ?? internalOverlayVisible
    const [draftRegion, setDraftRegion] = useState<
      (NormalizedViewerRegion & { entryId: string; regionIndex: number }) | null
    >(null)
    const dragRef = useRef<{
      mode: 'move' | 'resize'
      startX: number
      startY: number
      hasMoved?: boolean
      region: NormalizedViewerRegion & { entryId: string; regionIndex: number }
    } | null>(null)
    const latestRegionRef = useRef<
      (NormalizedViewerRegion & { entryId: string; regionIndex: number }) | null
    >(null)
    // PDF.js may transfer typed-array buffers to its worker. Keep the state-owned PDF bytes intact
    // so other consumers, including the Pages thumbnail strip, can render from the same source.
    const file = useMemo(() => (data ? { data: data.slice() } : null), [data])

    const zoomBy = (delta: number): void => {
      setZoom((current) => Math.min(2, Math.max(0.6, Number((current + delta).toFixed(2)))))
    }

    useImperativeHandle(ref, () => ({
      toggleOverlay: () => setInternalOverlayVisible((current) => !current),
      zoomIn: () => zoomBy(0.1),
      zoomOut: () => zoomBy(-0.1)
    }))

    useEffect(() => {
      const viewport = viewportRef.current
      if (!viewport) return
      const observer = new ResizeObserver(([entry]) => {
        setAvailableWidth(Math.max(280, entry.contentRect.width - 48))
      })
      observer.observe(viewport)
      return () => observer.disconnect()
    }, [])

    useEffect(() => {
      if (requestedPage && requestedPage >= 1) setPageNumber(requestedPage)
    }, [requestedPage])

    if (!file) {
      return (
        <div className="viewer-empty">
          <FileWarning size={28} aria-hidden="true" />
          <strong>No PDF loaded</strong>
          <span>Select a document from the source list.</span>
        </div>
      )
    }

    const displayedPage = highlight?.page ?? pageNumber
    const activeHighlight = highlight?.page === displayedPage ? highlight : undefined
    const displayedHighlights = highlights.filter((candidate) => candidate.page === displayedPage)
    const renderedPageWidth = Math.min(availableWidth, 820) * zoom
    const renderedPageAspectRatio = rotation % 180 === 0 ? pageAspectRatio : 1 / pageAspectRatio
    const showHighlightCount = showStatusOverlay && displayedHighlights.length > 0
    const viewerDescribedBy =
      [
        showHighlightCount ? highlightCountId : null,
        activeHighlight ? highlightDescriptionId : null
      ]
        .filter(Boolean)
        .join(' ') || undefined

    return (
      <section
        className="pdf-viewer"
        aria-label={`PDF viewer for ${fileName}`}
        aria-describedby={viewerDescribedBy}
      >
        {showHighlightCount && (
          <p className="sr-only" id={highlightCountId}>
            {describeViewerHighlightCount(displayedHighlights, displayedPage)}
          </p>
        )}
        {activeHighlight && (
          <p className="sr-only" id={highlightDescriptionId}>
            {describeViewerHighlight(activeHighlight)}
          </p>
        )}
        <div className="viewer-toolbar">
          <div className="page-controls">
            <button
              className="icon-button"
              type="button"
              title="Previous page"
              disabled={displayedPage <= 1}
              onClick={() => {
                const next = Math.max(1, displayedPage - 1)
                setPageNumber(next)
                onPageChange?.(next)
              }}
            >
              <ChevronLeft size={17} />
            </button>
            <label className="viewer-page-input">
              <span className="sr-only">PDF page</span>
              <input
                type="number"
                min={1}
                max={pageCount || undefined}
                value={displayedPage}
                onChange={(event) => {
                  const next = Math.min(
                    pageCount || Number.MAX_SAFE_INTEGER,
                    Math.max(1, Number(event.target.value) || 1)
                  )
                  setPageNumber(next)
                  onPageChange?.(next)
                }}
              />
              <span>/ {pageCount || '...'}</span>
            </label>
            <button
              className="icon-button"
              type="button"
              title="Next page"
              disabled={!pageCount || displayedPage >= pageCount}
              onClick={() => {
                const next = Math.min(pageCount, displayedPage + 1)
                setPageNumber(next)
                onPageChange?.(next)
              }}
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <button
            className="icon-button"
            type="button"
            title={
              showStatusOverlay
                ? 'Hide keep/maybe/exclude overlay'
                : 'Show keep/maybe/exclude overlay'
            }
            aria-pressed={showStatusOverlay}
            onClick={() => {
              if (onToggleHighlights) onToggleHighlights()
              else setInternalOverlayVisible((current) => !current)
            }}
          >
            {showStatusOverlay ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
          <div className="page-controls">
            <button
              className="icon-button"
              type="button"
              title="Zoom out"
              disabled={zoom <= 0.6}
              onClick={() => setZoom((current) => Math.max(0.6, current - 0.1))}
            >
              <ZoomOut size={17} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              className="icon-button"
              type="button"
              title="Zoom in"
              disabled={zoom >= 2}
              onClick={() => setZoom((current) => Math.min(2, current + 0.1))}
            >
              <ZoomIn size={17} />
            </button>
            <button
              className="icon-button"
              type="button"
              title="Rotate clockwise"
              onClick={() => setRotation((current) => ((current + 90) % 360) as ViewerRotation)}
            >
              <RotateCw size={17} />
            </button>
          </div>
        </div>
        <div className="viewer-viewport" ref={viewportRef}>
          <Document
            file={file}
            loading={<div className="viewer-message">Rendering PDF...</div>}
            error={
              <div className="viewer-message viewer-error">This PDF could not be rendered.</div>
            }
            onLoadSuccess={({ numPages }) => {
              setPageCount(numPages)
              setPageNumber((current) => Math.min(current, numPages))
            }}
          >
            <div
              className="pdf-page-wrap"
              style={{ width: renderedPageWidth, aspectRatio: renderedPageAspectRatio }}
            >
              <Page
                key={displayedPage}
                pageNumber={displayedPage}
                width={renderedPageWidth}
                rotate={rotation}
                onLoadSuccess={({ originalWidth, originalHeight }) => {
                  if (originalWidth > 0 && originalHeight > 0) {
                    setPageAspectRatio(originalWidth / originalHeight)
                  }
                }}
              />
              {showStatusOverlay &&
                displayedHighlights.map((candidate, index) => {
                  const isClickable = Boolean(onSelectHighlight && candidate.entryId)
                  const isEditable = Boolean(
                    highlightEditMode &&
                    candidate.selected &&
                    candidate.entryId &&
                    candidate.regionIndex !== undefined &&
                    onChangeHighlight
                  )
                  const isDraftRegion =
                    draftRegion !== null &&
                    draftRegion.entryId === candidate.entryId &&
                    draftRegion.regionIndex === candidate.regionIndex
                  const displayedRegion = isDraftRegion
                    ? draftRegion
                    : projectViewerRegion(candidate, rotation)
                  const beginEdit = (
                    event: React.PointerEvent<HTMLDivElement>,
                    mode: 'move' | 'resize'
                  ): void => {
                    if (!isEditable) return
                    event.stopPropagation()
                    if (event.currentTarget.setPointerCapture) {
                      event.currentTarget.setPointerCapture(event.pointerId)
                    }
                    const region = {
                      entryId: candidate.entryId!,
                      regionIndex: candidate.regionIndex!,
                      x: displayedRegion.x,
                      y: displayedRegion.y,
                      width: displayedRegion.width,
                      height: displayedRegion.height
                    }
                    dragRef.current = {
                      mode,
                      startX: event.clientX,
                      startY: event.clientY,
                      hasMoved: false,
                      region
                    }
                    latestRegionRef.current = region
                    setDraftRegion(region)
                  }
                  const continueEdit = (event: React.PointerEvent<HTMLDivElement>): void => {
                    const drag = dragRef.current
                    const page = event.currentTarget.parentElement?.getBoundingClientRect()
                    if (!drag || !page) return
                    const deltaX = (event.clientX - drag.startX) / page.width
                    const deltaY = (event.clientY - drag.startY) / page.height
                    if (
                      Math.abs(event.clientX - drag.startX) > 3 ||
                      Math.abs(event.clientY - drag.startY) > 3
                    ) {
                      drag.hasMoved = true
                    }
                    const next =
                      drag.mode === 'move'
                        ? {
                            ...drag.region,
                            x: Math.max(0, Math.min(1 - drag.region.width, drag.region.x + deltaX)),
                            y: Math.max(0, Math.min(1 - drag.region.height, drag.region.y + deltaY))
                          }
                        : {
                            ...drag.region,
                            width: Math.max(
                              0.01,
                              Math.min(1 - drag.region.x, drag.region.width + deltaX)
                            ),
                            height: Math.max(
                              0.01,
                              Math.min(1 - drag.region.y, drag.region.height + deltaY)
                            )
                          }
                    latestRegionRef.current = next
                    setDraftRegion(next)
                  }
                  const finishEdit = (event?: React.PointerEvent<HTMLDivElement>): void => {
                    if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId)
                    }
                    const drag = dragRef.current
                    const latestRegion = latestRegionRef.current
                    if (drag && !drag.hasMoved && isClickable && candidate.entryId) {
                      onSelectHighlight?.(candidate.entryId)
                    } else if (drag && latestRegion && drag.hasMoved) {
                      onChangeHighlight?.(
                        latestRegion.entryId,
                        latestRegion.regionIndex,
                        unprojectViewerRegion(latestRegion, rotation)
                      )
                    }
                    dragRef.current = null
                    latestRegionRef.current = null
                    setDraftRegion(null)
                  }
                  return (
                    <div
                      className={`source-status-highlight source-status-${candidate.status ?? 'maybe'} ${highlightStyleMode === 'border' ? 'is-border-only' : ''} ${candidate.selected ? 'is-selected' : ''} ${candidate.checked ? 'is-checked' : ''} ${isClickable ? 'is-clickable' : ''} ${isEditable ? 'is-editable' : ''}`}
                      key={`${candidate.page}-${candidate.x}-${candidate.y}-${index}`}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      aria-hidden={isClickable ? undefined : 'true'}
                      aria-pressed={isClickable ? Boolean(candidate.checked) : undefined}
                      aria-label={
                        isClickable
                          ? `${candidate.checked ? 'Selected. ' : ''}Jump to this entry in the review queue`
                          : undefined
                      }
                      title={isClickable ? 'Jump to this entry in the review queue' : undefined}
                      style={{
                        left: `${displayedRegion.x * 100}%`,
                        top: `${displayedRegion.y * 100}%`,
                        width: `${displayedRegion.width * 100}%`,
                        height: `${displayedRegion.height * 100}%`
                      }}
                      onPointerDown={isEditable ? (event) => beginEdit(event, 'move') : undefined}
                      onPointerMove={isEditable ? continueEdit : undefined}
                      onPointerUp={isEditable ? finishEdit : undefined}
                      onPointerCancel={isEditable ? finishEdit : undefined}
                      onClick={
                        isClickable ? () => onSelectHighlight!(candidate.entryId!) : undefined
                      }
                      onKeyDown={
                        isClickable
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                onSelectHighlight!(candidate.entryId!)
                              }
                            }
                          : undefined
                      }
                    >
                      {candidate.entryNumber !== undefined && (
                        <span className="source-status-number" aria-hidden="true">
                          {candidate.entryNumber}
                        </span>
                      )}
                      <span className="source-status-marker" aria-hidden="true">
                        {candidate.status === 'keep'
                          ? 'K'
                          : candidate.status === 'exclude'
                            ? 'X'
                            : 'M'}
                      </span>
                      {candidate.checked && (
                        <span className="source-status-check" aria-hidden="true">
                          <Check size={10} />
                        </span>
                      )}
                      {isEditable && (
                        <div
                          className="source-status-resize-handle"
                          title="Resize extraction box"
                          aria-hidden="true"
                          onPointerDown={(event) => beginEdit(event, 'resize')}
                        />
                      )}
                    </div>
                  )
                })}
            </div>
          </Document>
        </div>
      </section>
    )
  })
)
