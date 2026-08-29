import {
  keptEntriesPageDimensions,
  type KeptEntriesOrientation,
  type KeptEntriesPageSize
} from '../../../shared/keptEntriesLayout'

export interface CanvasPageDimensions {
  width: number
  height: number
}

export function getCanvasPageDimensions(
  pageSize: KeptEntriesPageSize,
  orientation: KeptEntriesOrientation
): CanvasPageDimensions {
  return keptEntriesPageDimensions(pageSize, orientation)
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
