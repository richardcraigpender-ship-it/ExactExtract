import type { OcrImagePage } from './tesseractProvider'
import { preprocessCanvas, type OcrPreprocessingOptions } from './preprocessing'

interface PdfJsRasterViewportLike {
  width: number
  height: number
}

interface PdfJsRenderTaskLike {
  promise: Promise<unknown>
  cancel?: () => void
}

interface PdfJsRasterPageLike {
  rotate?: number
  getViewport(options: { scale: number; rotation?: number }): PdfJsRasterViewportLike
  render(options: {
    canvasContext: CanvasRenderingContext2D
    viewport: PdfJsRasterViewportLike
  }): PdfJsRenderTaskLike
}

export interface PdfJsRasterDocumentLike {
  numPages: number
  getPage(pageNumber: number): Promise<PdfJsRasterPageLike>
}

export interface RasterizeOptions {
  scale?: number
  maxPixels?: number
  signal?: AbortSignal
  createCanvas?: (width: number, height: number) => HTMLCanvasElement
  onPageComplete?: (pageNumber: number, completed: number, total: number) => void
  preprocessing?: OcrPreprocessingOptions
}

const defaultCreateCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function validatePageNumbers(pageNumbers: readonly number[], pageCount: number): number[] {
  const pages = [...new Set(pageNumbers)].sort((left, right) => left - right)
  if (
    pages.some(
      (pageNumber) => !Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount
    )
  ) {
    throw new Error('OCR page numbers must exist in the PDF document.')
  }
  return pages
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Rasterization cancelled.', 'AbortError')
}

export async function rasterizePdfPages(
  documentId: string,
  pdf: PdfJsRasterDocumentLike,
  pageNumbers: readonly number[],
  options: RasterizeOptions = {}
): Promise<OcrImagePage[]> {
  if (documentId.trim().length === 0) throw new Error('documentId is required.')
  if (!Number.isInteger(pdf.numPages) || pdf.numPages < 0)
    throw new Error('PDF page count is invalid.')
  const scale = options.scale ?? 2
  const hasExplicitPixelLimit = options.maxPixels !== undefined
  const maxPixels = options.maxPixels ?? 20_000_000
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Raster scale must be positive.')
  if (!Number.isFinite(maxPixels) || maxPixels <= 0) throw new Error('maxPixels must be positive.')

  const selectedPages = validatePageNumbers(pageNumbers, pdf.numPages)
  const createCanvas = options.createCanvas ?? defaultCreateCanvas
  const output: OcrImagePage[] = []

  for (const [index, pageNumber] of selectedPages.entries()) {
    throwIfCancelled(options.signal)
    const page = await pdf.getPage(pageNumber)
    const baseViewport = page.getViewport({ scale: 1, rotation: page.rotate })
    const basePixels = Math.max(1, baseViewport.width * baseViewport.height)
    const adaptiveScale = hasExplicitPixelLimit
      ? scale
      : Math.min(scale, Math.sqrt(maxPixels / basePixels) * 0.999)
    const viewport = page.getViewport({ scale: adaptiveScale, rotation: page.rotate })
    const width = Math.ceil(viewport.width)
    const height = Math.ceil(viewport.height)
    if (width <= 0 || height <= 0 || width * height > maxPixels) {
      throw new Error(`Rasterized page ${pageNumber} exceeds the configured pixel limit.`)
    }
    const canvas = createCanvas(width, height)
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('A 2D canvas context is required for OCR rasterization.')

    const renderTask = page.render({ canvasContext: context, viewport })
    const abort = (): void => renderTask.cancel?.()
    options.signal?.addEventListener('abort', abort, { once: true })
    try {
      await renderTask.promise
      throwIfCancelled(options.signal)
    } finally {
      options.signal?.removeEventListener('abort', abort)
    }

    if (options.preprocessing) preprocessCanvas(canvas, options.preprocessing)

    output.push({ documentId, pageNumber, image: canvas, width, height })
    options.onPageComplete?.(pageNumber, index + 1, selectedPages.length)
  }

  return output
}
