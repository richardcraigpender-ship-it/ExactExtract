import React from 'react'

import type {
  KeptEntriesBackground,
  KeptEntriesCanvasLayout,
  KeptEntriesFontRef,
  KeptEntryPlacement,
  KeptImagePlacement,
  KeptImageSourceRef
} from '../../../shared/keptEntriesLayout'
import { useCanvasDrag } from '../hooks/useCanvasDrag'
import { getCanvasDropPoint, KEPT_ENTRY_DRAG_TYPE } from '../lib/canvasDrop'
import { getCanvasPageDimensions } from '../lib/canvasScale'
import './ExportCanvas.css'

interface ExportCanvasProps {
  layout: KeptEntriesCanvasLayout
  ariaLabel?: string
  zoom?: number
  previewMode?: 'combined' | 'text' | 'images'
  selectedPlacementId?: string | null
  onSelectPlacement?: (placementId: string) => void
  onPlacementChange?: (placement: KeptEntryPlacement) => void
  onDropEntry?: (entryId: string, x: number, y: number) => void
  onBackgroundChange?: (background: KeptEntriesBackground) => void
  /** 1-based page to render; version-1 layouts leave every placement on page 1. */
  pageNumber?: number
  selectedImagePlacementId?: string | null
  onSelectImagePlacement?: (placementId: string) => void
  onImagePlacementChange?: (placement: KeptImagePlacement) => void
  /** Layouts store references only, so the caller supplies displayable bytes. */
  resolveImageSource?: (source: KeptImageSourceRef) => string | undefined
}

function asPercent(value: number, total: number): string {
  return `${(value / total) * 100}%`
}

function fontFamily(fontRef: KeptEntriesFontRef): string {
  if (fontRef.kind === 'system') return `"${fontRef.family.replaceAll('"', '\\"')}"`
  if (fontRef.family === 'Times-Roman') return '"Times New Roman", Times, serif'
  if (fontRef.family === 'Courier') return 'Courier, monospace'
  return 'Helvetica, Arial, sans-serif'
}

function placementStyle(
  placement: KeptEntryPlacement,
  pageWidth: number,
  pageHeight: number
): React.CSSProperties {
  return {
    left: asPercent(placement.x, pageWidth),
    top: asPercent(placement.y, pageHeight),
    width: asPercent(placement.width, pageWidth),
    height: asPercent(placement.height, pageHeight),
    color: placement.color,
    fontFamily: fontFamily(placement.fontRef),
    fontSize: `${placement.fontSize}px`,
    fontStyle:
      placement.fontRef.kind === 'system' &&
      placement.fontRef.style?.toLowerCase().includes('italic')
        ? 'italic'
        : undefined,
    fontWeight:
      placement.fontRef.kind === 'standard-14' && placement.fontRef.family === 'Helvetica-Bold'
        ? 700
        : placement.fontRef.kind === 'system' &&
            placement.fontRef.style?.toLowerCase().includes('bold')
          ? 700
          : undefined,
    transform: `rotate(${placement.rotation}deg)`
  }
}

function imageDividerStyle(
  placement: KeptImagePlacement,
  divider: NonNullable<KeptEntriesCanvasLayout['imagePlacementOptions']>['divider'],
  pageWidth: number,
  pageHeight: number
): React.CSSProperties | undefined {
  if (!divider?.enabled) return undefined
  return {
    left: asPercent(divider.startX, pageWidth),
    top: asPercent(placement.y + placement.height, pageHeight),
    width: asPercent(Math.max(0, divider.endX - divider.startX), pageWidth),
    borderTop: `${divider.thickness}px solid ${divider.color}`,
    opacity: divider.opacity
  }
}

export function ExportCanvas({
  layout,
  ariaLabel = 'Kept entries export page preview',
  zoom = 1,
  previewMode = 'combined',
  selectedPlacementId = null,
  onSelectPlacement,
  onPlacementChange,
  onDropEntry,
  onBackgroundChange,
  pageNumber = 1,
  selectedImagePlacementId = null,
  onSelectImagePlacement,
  onImagePlacementChange,
  resolveImageSource
}: ExportCanvasProps): React.JSX.Element {
  const dimensions = getCanvasPageDimensions(layout.pageSize, layout.orientation)
  const canvasZoom = Math.min(2, Math.max(0.5, zoom))
  const interactive = Boolean(onPlacementChange)
  const imagesInteractive = Boolean(onImagePlacementChange)
  const drag = useCanvasDrag<KeptEntryPlacement>(dimensions, (placement) =>
    onPlacementChange?.(placement)
  )
  const imageDrag = useCanvasDrag<KeptImagePlacement>(dimensions, (placement) =>
    onImagePlacementChange?.(placement)
  )
  const backgroundDrag = useCanvasDrag<KeptEntriesBackground>(dimensions, (background) =>
    onBackgroundChange?.(background)
  )
  const visiblePlacements = layout.placements.filter(
    (placement) => (placement.pageNumber ?? 1) === pageNumber
  )
  const visibleImages = (layout.images ?? []).filter(
    (placement) => placement.pageNumber === pageNumber
  )
  const imageDivider = layout.imagePlacementOptions?.divider

  return (
    <div className="export-canvas-viewport">
      <div
        className="export-canvas-page"
        role={interactive ? 'region' : 'img'}
        aria-label={ariaLabel}
        data-page-size={layout.pageSize}
        data-orientation={layout.orientation}
        style={{
          aspectRatio: `${dimensions.width} / ${dimensions.height}`,
          width: `${760 * canvasZoom}px`,
          minWidth: `${320 * canvasZoom}px`
        }}
        onDragOver={
          onDropEntry
            ? (event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'copy'
              }
            : undefined
        }
        onDrop={
          onDropEntry
            ? (event) => {
                event.preventDefault()
                const entryId =
                  event.dataTransfer.getData(KEPT_ENTRY_DRAG_TYPE) ||
                  event.dataTransfer.getData('text/plain')
                if (!entryId) return
                const point = getCanvasDropPoint(
                  event.clientX,
                  event.clientY,
                  event.currentTarget.getBoundingClientRect(),
                  dimensions
                )
                onDropEntry(entryId, point.x, point.y)
              }
            : undefined
        }
      >
        {layout.background && (
          <div
            className={
              onBackgroundChange
                ? 'export-canvas-background is-editable'
                : 'export-canvas-background'
            }
            role={onBackgroundChange ? 'group' : undefined}
            aria-label={onBackgroundChange ? 'Move canvas background' : undefined}
            tabIndex={onBackgroundChange ? 0 : undefined}
            style={{
              left: asPercent(layout.background.x, dimensions.width),
              top: asPercent(layout.background.y, dimensions.height),
              width: asPercent(layout.background.width, dimensions.width),
              height: asPercent(layout.background.height, dimensions.height),
              opacity: layout.background.opacity
            }}
            onPointerDown={
              onBackgroundChange
                ? (event) => backgroundDrag.beginDrag(event, layout.background!, 'move')
                : undefined
            }
            onPointerMove={onBackgroundChange ? backgroundDrag.continueDrag : undefined}
            onPointerUp={onBackgroundChange ? backgroundDrag.endDrag : undefined}
            onPointerCancel={onBackgroundChange ? backgroundDrag.endDrag : undefined}
          >
            <img src={layout.background.dataUrl} alt="" />
            {onBackgroundChange && (
              <span
                className="export-canvas-resize-handle"
                role="button"
                aria-label="Resize canvas background"
                tabIndex={0}
                onPointerDown={(event) =>
                  backgroundDrag.beginDrag(event, layout.background!, 'resize')
                }
                onPointerMove={backgroundDrag.continueDrag}
                onPointerUp={backgroundDrag.endDrag}
                onPointerCancel={backgroundDrag.endDrag}
              />
            )}
          </div>
        )}
        <div className="export-canvas-content">
          {previewMode !== 'text' &&
            visibleImages.map((placement) => {
              const label = placement.entryId ?? placement.source.ref
              const src = resolveImageSource?.(placement.source)
              const dividerStyle = imageDividerStyle(
                placement,
                imageDivider,
                dimensions.width,
                dimensions.height
              )
              return (
                <React.Fragment key={placement.id}>
                  <div
                    className={`export-canvas-image ${
                      selectedImagePlacementId === placement.id ? 'is-selected' : ''
                    }`}
                    data-image-placement-id={placement.id}
                    data-source-kind={placement.source.kind}
                    data-fit={placement.fit}
                    data-resolved={src ? 'true' : 'false'}
                    role={imagesInteractive ? 'group' : undefined}
                    aria-label={
                      imagesInteractive
                        ? `${selectedImagePlacementId === placement.id ? 'Selected. ' : ''}Move image: ${label}`
                        : undefined
                    }
                    tabIndex={imagesInteractive ? 0 : undefined}
                    style={{
                      left: asPercent(placement.x, dimensions.width),
                      top: asPercent(placement.y, dimensions.height),
                      width: asPercent(placement.width, dimensions.width),
                      height: asPercent(placement.height, dimensions.height)
                    }}
                    onClick={
                      imagesInteractive ? () => onSelectImagePlacement?.(placement.id) : undefined
                    }
                    onKeyDown={
                      imagesInteractive
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onSelectImagePlacement?.(placement.id)
                            }
                          }
                        : undefined
                    }
                    onPointerDown={
                      imagesInteractive
                        ? (event) => {
                            onSelectImagePlacement?.(placement.id)
                            imageDrag.beginDrag(event, placement, 'move')
                          }
                        : undefined
                    }
                    onPointerMove={imagesInteractive ? imageDrag.continueDrag : undefined}
                    onPointerUp={imagesInteractive ? imageDrag.endDrag : undefined}
                    onPointerCancel={imagesInteractive ? imageDrag.endDrag : undefined}
                  >
                    {src ? (
                      <img src={src} alt="" data-fit={placement.fit} />
                    ) : (
                      <span className="export-canvas-image-placeholder">{`${label} (image not available)`}</span>
                    )}
                    {imagesInteractive && selectedImagePlacementId === placement.id && (
                      <span
                        className="export-canvas-resize-handle"
                        role="button"
                        aria-label={`Resize image: ${label}`}
                        tabIndex={0}
                        onPointerDown={(event) => imageDrag.beginDrag(event, placement, 'resize')}
                        onPointerMove={imageDrag.continueDrag}
                        onPointerUp={imageDrag.endDrag}
                        onPointerCancel={imageDrag.endDrag}
                      />
                    )}
                  </div>
                  {dividerStyle && (
                    <span
                      className="export-canvas-image-divider"
                      aria-hidden="true"
                      style={dividerStyle}
                    />
                  )}
                </React.Fragment>
              )
            })}
          {previewMode !== 'images' &&
            visiblePlacements.map((placement) => (
              <div
                className={`export-canvas-placement ${
                  selectedPlacementId === placement.id ? 'is-selected' : ''
                }`}
                data-entry-id={placement.entryId}
                data-placement-id={placement.id}
                key={placement.id}
                role={interactive ? 'group' : undefined}
                aria-label={
                  interactive
                    ? `${selectedPlacementId === placement.id ? 'Selected. ' : ''}Move text box: ${placement.text}`
                    : undefined
                }
                tabIndex={interactive ? 0 : undefined}
                style={placementStyle(placement, dimensions.width, dimensions.height)}
                onClick={interactive ? () => onSelectPlacement?.(placement.id) : undefined}
                onKeyDown={
                  interactive
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSelectPlacement?.(placement.id)
                        }
                      }
                    : undefined
                }
                onPointerDown={
                  interactive
                    ? (event) => {
                        onSelectPlacement?.(placement.id)
                        drag.beginDrag(event, placement, 'move')
                      }
                    : undefined
                }
                onPointerMove={interactive ? drag.continueDrag : undefined}
                onPointerUp={interactive ? drag.endDrag : undefined}
                onPointerCancel={interactive ? drag.endDrag : undefined}
              >
                {placement.text}
                {interactive && selectedPlacementId === placement.id && (
                  <span
                    className="export-canvas-resize-handle"
                    role="button"
                    aria-label={`Resize text box: ${placement.text}`}
                    tabIndex={0}
                    onPointerDown={(event) => drag.beginDrag(event, placement, 'resize')}
                    onPointerMove={drag.continueDrag}
                    onPointerUp={drag.endDrag}
                    onPointerCancel={drag.endDrag}
                  />
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
