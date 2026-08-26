import {
  createExtractionPlan,
  mergeParserOcrEntries,
  projectOcrEntries,
  type ExtractionPlan,
  type OcrRecognizedBlock,
  type ParserExtractionResult
} from '../extraction'
import type { ExtractionSettings, ProjectEntry } from '../shared/contracts'
import {
  rasterizePdfPages,
  type PdfJsRasterDocumentLike,
  type RasterizeOptions
} from './pdfjsRasterizer'
import { recognizeTesseractPages, type OcrImagePage, type OcrProgress } from './tesseractProvider'

export type OcrOrchestrationStage = 'planning' | 'rasterizing' | 'recognizing' | 'merging'

export interface OcrOrchestrationProgress {
  stage: OcrOrchestrationStage
  progress: number
  pageNumber?: number
  status?: string
}

export interface OcrOrchestrationResult {
  plan: ExtractionPlan
  ocrBlocks: OcrRecognizedBlock[]
  ocrEntries: ProjectEntry[]
  entries: ProjectEntry[]
}

export interface OcrOrchestrationDependencies {
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

function report(
  callback: ((progress: OcrOrchestrationProgress) => void) | undefined,
  value: OcrOrchestrationProgress
): void {
  callback?.({ ...value, progress: Math.max(0, Math.min(1, value.progress)) })
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('OCR orchestration cancelled.', 'AbortError')
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

function toPdfPointBlocks(
  parserResult: ParserExtractionResult,
  blocks: readonly OcrRecognizedBlock[]
): OcrRecognizedBlock[] {
  const pageByNumber = new Map(parserResult.pages.map((page) => [page.pageNumber, page]))
  return blocks.map((block) => {
    const page = pageByNumber.get(block.pageNumber)
    if (!page) throw new Error(`OCR returned unknown page ${block.pageNumber}.`)
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
    return {
      ...block,
      id: `p${block.pageNumber}:${block.id}`,
      bbox: pdfBox
    }
  })
}

export async function runOcrOrchestration(
  input: {
    parserResult: ParserExtractionResult
    parserEntries: readonly ProjectEntry[]
    pdf: PdfJsRasterDocumentLike
    settings: ExtractionSettings
    timestamp?: string
  },
  options: {
    signal?: AbortSignal
    onProgress?: (progress: OcrOrchestrationProgress) => void
    dependencies?: OcrOrchestrationDependencies
  } = {}
): Promise<OcrOrchestrationResult> {
  throwIfCancelled(options.signal)
  report(options.onProgress, { stage: 'planning', progress: 1 })
  const plan = createExtractionPlan(input.parserResult.preflight, input.settings)
  throwIfCancelled(options.signal)
  if (plan.ocrPages.length === 0) {
    report(options.onProgress, { stage: 'merging', progress: 1 })
    return {
      plan,
      ocrBlocks: [],
      ocrEntries: [],
      entries: mergeParserOcrEntries(input.parserEntries, [])
    }
  }

  const rasterize = options.dependencies?.rasterize ?? rasterizePdfPages
  const recognize = options.dependencies?.recognize ?? recognizeTesseractPages
  const imagePages = await rasterize(input.parserResult.documentId, input.pdf, plan.ocrPages, {
    signal: options.signal,
    onPageComplete: (pageNumber, completed, total) =>
      report(options.onProgress, {
        stage: 'rasterizing',
        pageNumber,
        progress: total === 0 ? 1 : completed / total
      })
  })

  let recognized: OcrRecognizedBlock[]
  try {
    throwIfCancelled(options.signal)
    recognized = await recognize(imagePages, plan.ocrLanguages, {
      signal: options.signal,
      onProgress: (progress) =>
        report(options.onProgress, {
          stage: 'recognizing',
          pageNumber: progress.pageNumber,
          status: progress.status,
          progress: progress.progress
        })
    })
  } finally {
    releaseRasterizedCanvases(imagePages)
  }
  throwIfCancelled(options.signal)
  const ocrBlocks = toPdfPointBlocks(input.parserResult, recognized)
  const ocrEntries = projectOcrEntries(input.parserResult.documentId, ocrBlocks, input.timestamp)
  report(options.onProgress, { stage: 'merging', progress: 1 })
  return {
    plan,
    ocrBlocks,
    ocrEntries,
    entries: mergeParserOcrEntries(input.parserEntries, ocrEntries)
  }
}
