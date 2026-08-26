import { useRef } from 'react'

import { getPixelsPerPdfPoint, pixelsToPdfPoints } from '../lib/canvasScale'

export type CanvasDragMode = 'move' | 'resize'

interface PointerDelta {
  x: number
  y: number
}

interface PageBounds {
  width: number
  height: number
}

export interface CanvasBox {
  x: number
  y: number
  width: number
  height: number
}

interface ActiveCanvasDrag<T extends CanvasBox> {
  mode: CanvasDragMode
  pointerId: number
  startClientX: number
  startClientY: number
  startBox: T
  pixelsPerPoint: number
}

export function updateBoxFromPointerDelta<T extends CanvasBox>(
  box: T,
  mode: CanvasDragMode,
  delta: PointerDelta,
  page: PageBounds
): T {
  if (mode === 'move') {
    return {
      ...box,
      x: Math.max(0, Math.min(page.width - box.width, box.x + delta.x)),
      y: Math.max(0, Math.min(page.height - box.height, box.y + delta.y))
    }
  }

  return {
    ...box,
    width: Math.max(24, Math.min(page.width - box.x, box.width + delta.x)),
    height: Math.max(16, Math.min(page.height - box.y, box.height + delta.y))
  }
}

export const updatePlacementFromPointerDelta = updateBoxFromPointerDelta

export function useCanvasDrag<T extends CanvasBox>(
  page: PageBounds,
  onChange: (box: T) => void
): {
  beginDrag: (event: React.PointerEvent<HTMLElement>, box: T, mode: CanvasDragMode) => void
  continueDrag: (event: React.PointerEvent<HTMLElement>) => void
  endDrag: (event: React.PointerEvent<HTMLElement>) => void
} {
  const activeDrag = useRef<ActiveCanvasDrag<T> | null>(null)

  const beginDrag = (
    event: React.PointerEvent<HTMLElement>,
    box: T,
    mode: CanvasDragMode
  ): void => {
    const canvas = event.currentTarget.closest<HTMLElement>('.export-canvas-page')
    if (!canvas) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    activeDrag.current = {
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBox: box,
      pixelsPerPoint: getPixelsPerPdfPoint(canvas.getBoundingClientRect().width, page.width)
    }
  }

  const continueDrag = (event: React.PointerEvent<HTMLElement>): void => {
    const active = activeDrag.current
    if (!active || active.pointerId !== event.pointerId) return
    onChange(
      updateBoxFromPointerDelta(
        active.startBox,
        active.mode,
        {
          x: pixelsToPdfPoints(event.clientX - active.startClientX, active.pixelsPerPoint),
          y: pixelsToPdfPoints(event.clientY - active.startClientY, active.pixelsPerPoint)
        },
        page
      )
    )
  }

  const endDrag = (event: React.PointerEvent<HTMLElement>): void => {
    if (activeDrag.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    activeDrag.current = null
  }

  return { beginDrag, continueDrag, endDrag }
}
