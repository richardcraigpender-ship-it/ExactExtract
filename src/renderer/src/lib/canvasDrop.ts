import { getPixelsPerPdfPoint, pixelsToPdfPoints } from './canvasScale'

export const KEPT_ENTRY_DRAG_TYPE = 'application/x-exact-extract-kept-entry'

interface KeptEntryDragData {
  effectAllowed: string
  setData: (format: string, data: string) => void
}

export function setKeptEntryDragData(dataTransfer: KeptEntryDragData, entryId: string): void {
  dataTransfer.effectAllowed = 'copyMove'
  dataTransfer.setData(KEPT_ENTRY_DRAG_TYPE, entryId)
  dataTransfer.setData('text/plain', entryId)
}

interface CanvasDropBounds {
  left: number
  top: number
  width: number
}

interface CanvasPageBounds {
  width: number
  height: number
}

export function getCanvasDropPoint(
  clientX: number,
  clientY: number,
  canvas: CanvasDropBounds,
  page: CanvasPageBounds
): { x: number; y: number } {
  const scale = getPixelsPerPdfPoint(canvas.width, page.width)
  return {
    x: Math.max(0, Math.min(page.width, pixelsToPdfPoints(clientX - canvas.left, scale))),
    y: Math.max(0, Math.min(page.height, pixelsToPdfPoints(clientY - canvas.top, scale)))
  }
}
