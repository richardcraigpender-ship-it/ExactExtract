import { pdfjs } from 'react-pdf'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { ProjectEntry } from '../../../shared/contracts'
import type { TableTemplate } from '../../../extraction'
import {
  extractPdfJsDocument,
  groupPageLines,
  parseTextLayerPage,
  projectParserEntries,
  readPdfJsTextLayer,
  type ParserExtractionResult
} from '../../../extraction'
import type { SourceReferenceCandidate } from '../../../review'
import { extractReferencesFromText } from '../../../review'
import { classifySemanticLines } from '../../../extraction/semantics'
import {
  runOcrReferenceScan,
  runOcrOrchestration,
  type OcrReferenceRescanProgress,
  type OcrOrchestrationProgress,
  type OcrOrchestrationResult,
  type PdfJsRasterDocumentLike
} from '../../../ocr'
import { detectPageNumberStyle, type DetectedPageNumberMatch } from '../../../style'
import type { DocumentStyleProfile, ExtractionSettings } from '../../../shared/contracts'
import { withPdfDocument } from './pdfResourceLifecycle'

pdfjs.GlobalWorkerOptions.workerSrc = typeof pdfWorker === 'string' ? pdfWorker : ''

export interface PdfPreflightResult {
  pageCount: number
  textPageCount: number
  imagePageCount: number
  averageCharactersPerPage: number
  recommendation: 'Parser only' | 'Selective OCR' | 'OCR recommended'
  pages: PdfPagePreflightResult[]
  completedAt: string
}

export interface PdfPagePreflightResult {
  pageNumber: number
  width: number
  height: number
  rotation: 0 | 90 | 180 | 270
  characterCount: number
  kind: 'text' | 'image' | 'sparse' | 'rotated'
  confidence: number
  ocrRecommended: boolean
}

export async function analyzePdf(data: Uint8Array): Promise<PdfPreflightResult> {
  return withPdfDocument(
    () => pdfjs.getDocument({ data: data.slice() }).promise,
    async (pdf) => {
      let textPageCount = 0
      let totalCharacters = 0
      const pages: PdfPagePreflightResult[] = []

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 1 })
        const content = await page.getTextContent()
        const characterCount = content.items.reduce((total, item) => {
          return total + ('str' in item ? item.str.trim().length : 0)
        }, 0)
        totalCharacters += characterCount
        if (characterCount >= 24) textPageCount += 1
        const rotation = ([0, 90, 180, 270].includes(page.rotate) ? page.rotate : 0) as
          0 | 90 | 180 | 270
        const kind =
          rotation !== 0
            ? 'rotated'
            : characterCount === 0
              ? 'image'
              : characterCount < 24
                ? 'sparse'
                : 'text'
        pages.push({
          pageNumber,
          width: viewport.width,
          height: viewport.height,
          rotation,
          characterCount,
          kind,
          confidence: characterCount >= 24 ? 0.95 : characterCount === 0 ? 0.9 : 0.65,
          ocrRecommended: characterCount < 24
        })
      }

      const imagePageCount = pdf.numPages - textPageCount
      const imageRatio = pdf.numPages === 0 ? 0 : imagePageCount / pdf.numPages
      const recommendation =
        imageRatio === 0 ? 'Parser only' : imageRatio < 0.5 ? 'Selective OCR' : 'OCR recommended'

      return {
        pageCount: pdf.numPages,
        textPageCount,
        imagePageCount,
        averageCharactersPerPage:
          pdf.numPages === 0 ? 0 : Math.round(totalCharacters / pdf.numPages),
        recommendation,
        pages,
        completedAt: new Date().toISOString()
      }
    }
  )
}

export interface LocalParserResult {
  extraction: ParserExtractionResult
  entries: ProjectEntry[]
  ocr?: OcrOrchestrationResult
}

export interface LocalExtractionOptions {
  settings?: ExtractionSettings
  tableTemplate?: TableTemplate
  signal?: AbortSignal
  onOcrProgress?: (progress: OcrOrchestrationProgress) => void
}

export interface ReferenceScanOptions {
  entries?: readonly ProjectEntry[]
  languages?: readonly string[]
  pageNumbers?: readonly number[]
  signal?: AbortSignal
  onProgress?: (progress: OcrReferenceRescanProgress) => void
}

function keptEntryPages(
  documentId: string,
  entries: readonly ProjectEntry[] | undefined
): number[] {
  return [
    ...new Set(
      (entries ?? [])
        .filter((entry) => entry.status === 'keep')
        .flatMap((entry) =>
          entry.regions.flatMap((region) =>
            region.documentId === documentId ? [region.pageNumber] : []
          )
        )
    )
  ].sort((left, right) => left - right)
}

export async function scanPdfReferenceCandidates(
  documentId: string,
  data: Uint8Array,
  options: ReferenceScanOptions = {}
): Promise<SourceReferenceCandidate[]> {
  return withPdfDocument(
    () => pdfjs.getDocument({ data: data.slice() }).promise,
    async (pdf) => {
      const selectedPages =
        options.pageNumbers && options.pageNumbers.length > 0
          ? [...new Set(options.pageNumbers)].sort((left, right) => left - right)
          : keptEntryPages(documentId, options.entries)
      const pageNumbers =
        selectedPages.length > 0
          ? selectedPages
          : Array.from({ length: pdf.numPages }, (_, index) => index + 1)
      const result = await runOcrReferenceScan(
        documentId,
        pdf as unknown as PdfJsRasterDocumentLike,
        {
          languages: options.languages ?? ['eng'],
          pageNumbers,
          signal: options.signal,
          onProgress: options.onProgress,
          // Match the initial extraction, which stores the printed detail block verbatim.
          mode: 'verbatim-detail'
        }
      )
      return result.candidates.map((candidate) => ({
        documentId: candidate.documentId,
        pageNumber: candidate.pageNumber,
        text: candidate.text,
        bbox: candidate.bbox,
        source: candidate.source,
        ...(candidate.detailText ? { detailText: candidate.detailText } : {})
      }))
    }
  )
}

export async function detectSourcePageNumberStyle(
  documentId: string,
  data: Uint8Array,
  styleProfile?: DocumentStyleProfile
): Promise<DetectedPageNumberMatch | undefined> {
  return withPdfDocument(
    () => pdfjs.getDocument({ data: data.slice() }).promise,
    async (pdf) => {
      const textLayer = await readPdfJsTextLayer(documentId, pdf)
      const pages = textLayer.map((pageInput) => {
        const parsed = parseTextLayerPage(pageInput)
        const lines = groupPageLines(parsed)
        return {
          pageNumber: parsed.pageNumber,
          width: parsed.width,
          height: parsed.height,
          lines: lines.map((line) => ({ text: line.text, bbox: line.bbox }))
        }
      })
      return detectPageNumberStyle(pages, styleProfile)
    }
  )
}

export async function scanPdfTextReferenceCandidates(
  documentId: string,
  data: Uint8Array,
  pageNumbers?: ReadonlySet<number>
): Promise<SourceReferenceCandidate[]> {
  return withPdfDocument(
    () => pdfjs.getDocument({ data: data.slice() }).promise,
    async (pdf) => {
      const extraction = await extractPdfJsDocument(documentId, pdf)
      return extraction.blocks.flatMap((block) => {
        if (pageNumbers && !pageNumbers.has(block.pageNumber)) return []
        const references = extractReferencesFromText(block.text)
        return references.length === 0
          ? []
          : [
              {
                documentId: block.documentId,
                pageNumber: block.pageNumber,
                text: block.text,
                bbox: block.bbox,
                source: 'pdf-text-reference-scan' as const,
                references
              }
            ]
      })
    }
  )
}

export async function extractPdfLocally(
  documentId: string,
  data: Uint8Array,
  options: LocalExtractionOptions = {}
): Promise<LocalParserResult> {
  const completedAt = new Date().toISOString()
  return withPdfDocument(
    () => pdfjs.getDocument({ data: data.slice() }).promise,
    async (pdf) => {
      const extraction = await extractPdfJsDocument(
        documentId,
        pdf,
        completedAt,
        options.tableTemplate
      )
      const semanticByLine = new Map(
        classifySemanticLines(extraction.lines).map((candidate) => [candidate.lineId, candidate])
      )
      const parserEntries = projectParserEntries(extraction, completedAt).map((entry) => {
        const lineId = entry.id.endsWith(':entry') ? entry.id.slice(0, -':entry'.length) : entry.id
        const semantic = semanticByLine.get(lineId)
        return semantic
          ? {
              ...entry,
              category: semantic.kind,
              tags: [...entry.tags, semantic.kind]
            }
          : entry
      })
      if (!options.settings) return { extraction, entries: parserEntries }

      const ocr = await runOcrOrchestration(
        {
          parserResult: extraction,
          parserEntries,
          pdf: pdf as unknown as PdfJsRasterDocumentLike,
          settings: options.settings,
          timestamp: completedAt
        },
        { signal: options.signal, onProgress: options.onOcrProgress }
      )
      return { extraction, entries: ocr.entries, ocr }
    }
  )
}
