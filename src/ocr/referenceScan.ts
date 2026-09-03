import type { OcrRecognizedBlock } from '../extraction'
import type { BoundingBox } from '../shared/contracts'
import { extractReferencesFromText } from '../review/references'
import {
  rasterizePdfPages,
  type PdfJsRasterDocumentLike,
  type RasterizeOptions
} from './pdfjsRasterizer'
import { recognizeTesseractPages, type OcrImagePage, type OcrProgress } from './tesseractProvider'

export interface OcrReferenceCandidate {
  documentId: string
  pageNumber: number
  text: string
  bbox: BoundingBox
  confidence: number
  source: 'ocr-reference-scan'
  references: string[]
}

export interface OcrReferenceScanSummary {
  scannedPageCount: number
  candidateCount: number
  referenceCount: number
  skippedLowConfidenceCount: number
}

export interface OcrReferenceScanResult {
  candidates: OcrReferenceCandidate[]
  summary: OcrReferenceScanSummary
}

export interface OcrReferenceScanOptions {
  minConfidence?: number
}

export interface OcrReferenceRescanProgress {
  stage: 'rasterizing' | 'recognizing' | 'filtering'
  progress: number
  pageNumber?: number
  status?: string
}

export interface OcrReferenceRescanDependencies {
  rasterize?: (
    documentId: string,
    pdf: PdfJsRasterDocumentLike,
    pageNumbers: readonly number[],
    options?: RasterizeOptions
  ) => Promise<OcrImagePage[]>
  recognize?: (
    pages: readonly OcrImagePage[],
    languages: readonly string[],
    options?: {
      onProgress?: (progress: OcrProgress) => void
      signal?: AbortSignal
    }
  ) => Promise<OcrRecognizedBlock[]>
}

export interface RunOcrReferenceScanOptions extends OcrReferenceScanOptions {
  languages: readonly string[]
  pageNumbers: readonly number[]
  signal?: AbortSignal
  onProgress?: (progress: OcrReferenceRescanProgress) => void
  dependencies?: OcrReferenceRescanDependencies
}

export function extractOcrReferenceCandidates(
  blocks: readonly OcrRecognizedBlock[],
  options: OcrReferenceScanOptions = {}
): OcrReferenceScanResult {
  const minConfidence = Math.max(0, Math.min(1, options.minConfidence ?? 0.45))
  const scannedPages = new Set<number>()
  const candidates: OcrReferenceCandidate[] = []
  let skippedLowConfidenceCount = 0

  for (const block of blocks) {
    scannedPages.add(block.pageNumber)
    const references = extractReferencesFromText(block.text)
    if (references.length === 0) continue
    if (block.confidence < minConfidence) {
      skippedLowConfidenceCount += 1
      continue
    }
    candidates.push({
      documentId: block.documentId,
      pageNumber: block.pageNumber,
      text: block.text,
      bbox: { ...block.bbox },
      confidence: block.confidence,
      source: 'ocr-reference-scan',
      references
    })
  }

  return {
    candidates,
    summary: {
      scannedPageCount: scannedPages.size,
      candidateCount: candidates.length,
      referenceCount: candidates.reduce(
        (total, candidate) => total + candidate.references.length,
        0
      ),
      skippedLowConfidenceCount
    }
  }
}

function report(
  callback: ((progress: OcrReferenceRescanProgress) => void) | undefined,
  value: OcrReferenceRescanProgress
): void {
  callback?.({ ...value, progress: Math.max(0, Math.min(1, value.progress)) })
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('OCR reference scan cancelled.', 'AbortError')
}

function releaseRasterizedCanvases(pages: readonly OcrImagePage[]): void {
  for (const page of pages) {
    const image = page.image
    if (
      typeof image !== 'object' ||
      image === null ||
      !('getContext' in image) ||
      typeof image.getContext !== 'function'
    ) {
      continue
    }
    const canvas = image as HTMLCanvasElement
    canvas.width = 0
    canvas.height = 0
  }
}

async function pageDimensions(
  pdf: PdfJsRasterDocumentLike,
  pageNumber: number
): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1, rotation: page.rotate })
  return { width: viewport.width, height: viewport.height }
}

async function toPdfPointBlocks(
  pdf: PdfJsRasterDocumentLike,
  blocks: readonly OcrRecognizedBlock[]
): Promise<OcrRecognizedBlock[]> {
  const dimensions = new Map<number, { width: number; height: number }>()
  return Promise.all(
    blocks.map(async (block) => {
      const page = dimensions.get(block.pageNumber) ?? (await pageDimensions(pdf, block.pageNumber))
      dimensions.set(block.pageNumber, page)
      const bbox = block.bbox
      const pdfBox =
        bbox.coordinateSpace === 'normalized'
          ? {
              x: bbox.x * page.width,
              y: page.height - (bbox.y + bbox.height) * page.height,
              width: bbox.width * page.width,
              height: bbox.height * page.height,
              coordinateSpace: 'pdf-points' as const
            }
          : { ...bbox }
      return { ...block, bbox: pdfBox }
    })
  )
}

export async function runOcrReferenceScan(
  documentId: string,
  pdf: PdfJsRasterDocumentLike,
  options: RunOcrReferenceScanOptions
): Promise<OcrReferenceScanResult> {
  throwIfCancelled(options.signal)
  const rasterize = options.dependencies?.rasterize ?? rasterizePdfPages
  const recognize = options.dependencies?.recognize ?? recognizeTesseractPages
  let imagePages: OcrImagePage[] = []

  try {
    imagePages = await rasterize(documentId, pdf, options.pageNumbers, {
      scale: 3,
      maxPixels: 24_000_000,
      signal: options.signal,
      onPageComplete: (pageNumber, completed, total) =>
        report(options.onProgress, {
          stage: 'rasterizing',
          pageNumber,
          progress: total === 0 ? 1 : completed / total
        })
    })
    throwIfCancelled(options.signal)
    const recognized = await recognize(imagePages, options.languages, {
      signal: options.signal,
      onProgress: (progress) =>
        report(options.onProgress, {
          stage: 'recognizing',
          pageNumber: progress.pageNumber,
          status: progress.status,
          progress: progress.progress
        })
    })
    throwIfCancelled(options.signal)
    report(options.onProgress, { stage: 'filtering', progress: 1 })
    const result = extractOcrReferenceCandidates(await toPdfPointBlocks(pdf, recognized), options)
    return {
      ...result,
      summary: {
        ...result.summary,
        scannedPageCount: new Set(imagePages.map((page) => page.pageNumber)).size
      }
    }
  } finally {
    releaseRasterizedCanvases(imagePages)
  }
}
