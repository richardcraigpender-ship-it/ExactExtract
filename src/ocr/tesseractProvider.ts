import { createWorker, type ImageLike, type LoggerMessage, type Worker } from 'tesseract.js'

import type { OcrRecognizedBlock } from '../extraction'
import {
  getOcrLanguageAssetUrl,
  OCR_CORE_FILE_URL,
  OCR_LANGUAGE_DATA_URL,
  OCR_WORKER_URL
} from '../shared/ocrAssets'

export const SUPPORTED_OCR_LANGUAGES = ['eng', 'spa', 'fra', 'deu'] as const

export class OcrProviderError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unsupported-language'
      | 'missing-language-data'
      | 'worker-start-failed'
      | 'recognition-failed',
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'OcrProviderError'
  }
}

export interface OcrImagePage {
  documentId: string
  pageNumber: number
  image: ImageLike
  width: number
  height: number
}

export interface OcrProgress {
  pageNumber: number
  status: string
  progress: number
}

export interface TesseractWorkerLike {
  recognize: Worker['recognize']
  terminate: Worker['terminate']
}

export type TesseractWorkerFactory = (
  languages: string[],
  onProgress?: (message: LoggerMessage) => void
) => Promise<TesseractWorkerLike>

export function getOfflineTesseractWorkerOptions(
  onProgress?: (message: LoggerMessage) => void
): Parameters<typeof createWorker>[2] {
  return {
    workerPath: OCR_WORKER_URL,
    corePath: OCR_CORE_FILE_URL,
    langPath: OCR_LANGUAGE_DATA_URL,
    gzip: true,
    // Bundled language data is authoritative; avoid stale or incomplete browser-cache entries.
    cacheMethod: 'none',
    ...(onProgress ? { logger: onProgress } : {})
  }
}

export async function assertOfflineOcrLanguageAssets(
  languages: readonly string[],
  fetchAsset: typeof fetch = globalThis.fetch
): Promise<void> {
  for (const language of languages) {
    const assetUrl = getOcrLanguageAssetUrl(language)
    try {
      const response = await fetchAsset(assetUrl, { method: 'HEAD', cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      throw new OcrProviderError(
        `OCR language data for ${language} is unavailable at ${assetUrl}. Reinstall EXACT EXTRACT to restore the bundled OCR assets.`,
        'missing-language-data',
        { cause: error }
      )
    }
  }
}

const createTesseractWorker: TesseractWorkerFactory = (languages, onProgress) =>
  createWorker(languages, undefined, getOfflineTesseractWorkerOptions(onProgress))

function validatePage(page: OcrImagePage): void {
  if (page.documentId.trim().length === 0) throw new Error('OCR documentId is required.')
  if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1) {
    throw new Error('OCR pageNumber must be a positive integer.')
  }
  if (
    !Number.isFinite(page.width) ||
    !Number.isFinite(page.height) ||
    page.width <= 0 ||
    page.height <= 0
  ) {
    throw new Error('OCR image dimensions must be positive finite numbers.')
  }
}

function normalizeConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0
  return Math.max(0, Math.min(1, confidence / 100))
}

function validateLanguages(languages: readonly string[]): string[] {
  const normalized = [...new Set(languages.map((language) => language.trim().toLocaleLowerCase()))]
  if (normalized.length === 0 || normalized.some((language) => language.length === 0)) {
    throw new OcrProviderError('Select at least one OCR language.', 'unsupported-language')
  }
  const unsupported = normalized.filter(
    (language) =>
      !SUPPORTED_OCR_LANGUAGES.includes(language as (typeof SUPPORTED_OCR_LANGUAGES)[number])
  )
  if (unsupported.length > 0) {
    throw new OcrProviderError(
      `Unsupported OCR language: ${unsupported.join(', ')}. Supported languages: ${SUPPORTED_OCR_LANGUAGES.join(', ')}.`,
      'unsupported-language'
    )
  }
  return normalized
}

export async function recognizeTesseractPages(
  pages: readonly OcrImagePage[],
  languages: readonly string[],
  options: {
    createWorker?: TesseractWorkerFactory
    onProgress?: (progress: OcrProgress) => void
    signal?: AbortSignal
  } = {}
): Promise<OcrRecognizedBlock[]> {
  const validatedLanguages = validateLanguages(languages)
  pages.forEach(validatePage)
  if (pages.length === 0) return []

  if (!options.createWorker) {
    await assertOfflineOcrLanguageAssets(validatedLanguages)
  }

  let activePageNumber = pages[0]!.pageNumber
  const workerFactory = options.createWorker ?? createTesseractWorker
  let worker: TesseractWorkerLike
  try {
    worker = await workerFactory(validatedLanguages, (message) => {
      options.onProgress?.({
        pageNumber: activePageNumber,
        status: message.status,
        progress: Math.max(0, Math.min(1, message.progress))
      })
    })
  } catch (error) {
    const cause = error instanceof Error && error.message ? ` (${error.message})` : ''
    throw new OcrProviderError(
      `OCR could not start. The ${validatedLanguages.join(', ')} language data could not be loaded${cause}`,
      'worker-start-failed',
      { cause: error }
    )
  }

  try {
    const blocks: OcrRecognizedBlock[] = []
    for (const page of pages) {
      if (options.signal?.aborted) throw new DOMException('OCR cancelled.', 'AbortError')
      activePageNumber = page.pageNumber
      let result: Awaited<ReturnType<TesseractWorkerLike['recognize']>>
      try {
        result = await worker.recognize(page.image, {}, { text: true, blocks: true })
      } catch (error) {
        if (options.signal?.aborted) throw new DOMException('OCR cancelled.', 'AbortError')
        throw new OcrProviderError(
          `OCR failed on page ${page.pageNumber}. Retry the page or choose a different language.`,
          'recognition-failed',
          { cause: error }
        )
      }
      const words =
        result.data.blocks?.flatMap((block) =>
          block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words))
        ) ?? []

      words.forEach((word, index) => {
        const text = word.text.replace(/\s+/g, ' ').trim()
        const width = word.bbox.x1 - word.bbox.x0
        const height = word.bbox.y1 - word.bbox.y0
        if (text.length === 0 || width <= 0 || height <= 0) return
        blocks.push({
          id: `w${index + 1}`,
          documentId: page.documentId,
          pageNumber: page.pageNumber,
          text,
          confidence: normalizeConfidence(word.confidence),
          bbox: {
            x: word.bbox.x0 / page.width,
            y: word.bbox.y0 / page.height,
            width: width / page.width,
            height: height / page.height,
            coordinateSpace: 'normalized'
          }
        })
      })
      options.onProgress?.({ pageNumber: page.pageNumber, status: 'complete', progress: 1 })
    }
    return blocks
  } finally {
    await worker.terminate()
  }
}
