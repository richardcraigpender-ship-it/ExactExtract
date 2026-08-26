import { extractDocumentTextLayer } from './pipeline'
import type {
  ParserExtractionResult,
  PdfTextItem,
  TableTemplate,
  TextLayerPageInput
} from './types'

interface PdfJsViewportLike {
  width: number
  height: number
}

interface PdfJsTextContentLike {
  items: readonly unknown[]
  styles?: Record<string, { ascent?: number; descent?: number }>
}

interface PdfJsPageLike {
  rotate: number
  getViewport(options: { scale: number; rotation?: number }): PdfJsViewportLike
  getTextContent(): Promise<PdfJsTextContentLike>
  getOperatorList?: () => Promise<{ fnArray: readonly number[] }>
}

const PDF_JS_IMAGE_OPERATORS = new Set([83, 84, 85, 86, 87, 88, 89])

export interface PdfJsDocumentLike {
  numPages: number
  getPage(pageNumber: number): Promise<PdfJsPageLike>
}

function isTextItem(value: unknown): value is PdfTextItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.str === 'string' &&
    Array.isArray(item.transform) &&
    item.transform.length === 6 &&
    item.transform.every((part) => typeof part === 'number') &&
    typeof item.width === 'number' &&
    typeof item.height === 'number'
  )
}

function fontAscentRatio(item: PdfTextItem, styles: PdfJsTextContentLike['styles']): number {
  const style = item.fontName ? styles?.[item.fontName] : undefined
  const ascent = style?.ascent
  const descent = style?.descent
  if (typeof ascent === 'number' && Number.isFinite(ascent)) return ascent
  if (typeof descent === 'number' && Number.isFinite(descent)) return 1 + descent
  return 0.8
}

function normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((rotation % 360) + 360) % 360
  return normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0
}

function countImageOperators(fnArray: readonly number[]): number {
  return fnArray.reduce(
    (count, operator) => count + (PDF_JS_IMAGE_OPERATORS.has(operator) ? 1 : 0),
    0
  )
}

export async function readPdfJsTextLayer(
  documentId: string,
  pdf: PdfJsDocumentLike
): Promise<TextLayerPageInput[]> {
  if (!Number.isInteger(pdf.numPages) || pdf.numPages < 0) {
    throw new Error('PDF page count must be a non-negative integer.')
  }

  const pages: TextLayerPageInput[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const rotation = normalizeRotation(page.rotate)
    const viewport = page.getViewport({ scale: 1, rotation: 0 })
    const [content, operatorList] = await Promise.all([
      page.getTextContent(),
      page.getOperatorList?.() ?? Promise.resolve(undefined)
    ])

    pages.push({
      documentId,
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      rotation,
      items: content.items.filter(isTextItem).map((item) => ({
        ...item,
        fontAscentRatio: fontAscentRatio(item, content.styles)
      })),
      imageObjectCount: operatorList ? countImageOperators(operatorList.fnArray) : 0
    })
  }

  return pages
}

export async function extractPdfJsDocument(
  documentId: string,
  pdf: PdfJsDocumentLike,
  completedAt?: string,
  tableTemplate?: TableTemplate
): Promise<ParserExtractionResult> {
  return extractDocumentTextLayer(
    documentId,
    await readPdfJsTextLayer(documentId, pdf),
    completedAt,
    tableTemplate
  )
}
