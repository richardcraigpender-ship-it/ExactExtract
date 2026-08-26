import type { KeptEntriesOrientation, KeptEntriesPageSize } from '../../../shared/keptEntriesLayout'

export interface CanvasPageDimensions {
  width: number
  height: number
}

const PAGE_DIMENSIONS: Record<KeptEntriesPageSize, CanvasPageDimensions> = {
  letter: { width: 612, height: 792 },
  a4: { width: 595, height: 842 }
}

export function getCanvasPageDimensions(
  pageSize: KeptEntriesPageSize,
  orientation: KeptEntriesOrientation
): CanvasPageDimensions {
  const dimensions = PAGE_DIMENSIONS[pageSize]
  return orientation === 'portrait'
    ? { ...dimensions }
    : { width: dimensions.height, height: dimensions.width }
}

export function getPixelsPerPdfPoint(canvasWidthPixels: number, pageWidthPoints: number): number {
  if (!Number.isFinite(canvasWidthPixels) || canvasWidthPixels <= 0) {
    throw new Error('Canvas width must be a positive finite number.')
  }
  if (!Number.isFinite(pageWidthPoints) || pageWidthPoints <= 0) {
    throw new Error('PDF page width must be a positive finite number.')
  }
  return canvasWidthPixels / pageWidthPoints
}

export function pdfPointsToPixels(points: number, pixelsPerPoint: number): number {
  return points * pixelsPerPoint
}

export function pixelsToPdfPoints(pixels: number, pixelsPerPoint: number): number {
  if (!Number.isFinite(pixelsPerPoint) || pixelsPerPoint <= 0) {
    throw new Error('Canvas scale must be a positive finite number.')
  }
  return pixels / pixelsPerPoint
}
