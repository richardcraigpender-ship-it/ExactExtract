import React from 'react'

import type {
  KeptEntriesBackground,
  KeptEntriesCanvasLayout,
  KeptEntriesFontRef,
  KeptEntryPlacement
} from '../../../shared/keptEntriesLayout'
import { useCanvasDrag } from '../hooks/useCanvasDrag'
import { getCanvasDropPoint, KEPT_ENTRY_DRAG_TYPE } from '../lib/canvasDrop'
import { getCanvasPageDimensions } from '../lib/canvasScale'
import './ExportCanvas.css'

interface ExportCanvasProps {
  layout: KeptEntriesCanvasLayout
  ariaLabel?: string
  selectedPlacementId?: string | null
  onSelectPlacement?: (placementId: string) => void
  onPlacementChange?: (placement: KeptEntryPlacement) => void
  onDropEntry?: (entryId: string, x: number, y: number) => void
  onBackgroundChange?: (background: KeptEntriesBackground) => void
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

export function ExportCanvas({
  layout,
  ariaLabel = 'Kept entries export page preview',
  selectedPlacementId = null,
  onSelectPlacement,
  onPlacementChange,
  onDropEntry,
  onBackgroundChange
}: ExportCanvasProps): React.JSX.Element {
  const dimensions = getCanvasPageDimensions(layout.pageSize, layout.orientation)
  const interactive = Boolean(onPlacementChange)
  const drag = useCanvasDrag<KeptEntryPlacement>(dimensions, (placement) =>
    onPlacementChange?.(placement)
  )
  const backgroundDrag = useCanvasDrag<KeptEntriesBackground>(dimensions, (background) =>
    onBackgroundChange?.(background)
  )

  return (
    <div className="export-canvas-viewport">
      <div
        className="export-canvas-page"
        role={interactive ? 'region' : 'img'}
        aria-label={ariaLabel}
        data-page-size={layout.pageSize}
        data-orientation={layout.orientation}
        style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
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
          {layout.placements.map((placement) => (
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
