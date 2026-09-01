import { extractDocumentTextLayer } from './pipeline'
import type {
  PageVisualRule,
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
  getOperatorList?: () => Promise<{ fnArray: readonly number[]; argsArray?: readonly unknown[] }>
}

const PDF_JS_IMAGE_OPERATORS = new Set([83, 84, 85, 86, 87, 88, 89])
const PDF_JS_LINE_WIDTH = 2
const PDF_JS_STROKE_RGB = 58
const PDF_JS_CONSTRUCT_PATH = 91
const PDF_JS_STROKE_OPERATORS = new Set([20, 21, 24])
const PDF_JS_MOVE_TO = 13
const PDF_JS_LINE_TO = 14
const PDF_JS_RECTANGLE = 19

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

function hexChannel(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value * 255)))
    .toString(16)
    .padStart(2, '0')
}

function rgbHex(args: readonly unknown[]): string | undefined {
  if (args.length < 3 || !args.slice(0, 3).every((value) => typeof value === 'number'))
    return undefined
  const [red, green, blue] = args as [number, number, number]
  return `#${hexChannel(red)}${hexChannel(green)}${hexChannel(blue)}`
}

function numbers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number')
    : []
}

function visualRulesFromPath(
  operators: readonly number[],
  args: readonly unknown[],
  thickness: number,
  colour: string | undefined
): PageVisualRule[] {
  const rules: PageVisualRule[] = []
  let x = 0
  let y = 0
  let offset = 0
  for (const operator of operators) {
    if (operator === PDF_JS_MOVE_TO) {
      const [nextX, nextY] = args.slice(offset, offset + 2) as [
        number | undefined,
        number | undefined
      ]
      if (typeof nextX === 'number' && typeof nextY === 'number') {
        x = nextX
        y = nextY
      }
      offset += 2
    } else if (operator === PDF_JS_LINE_TO) {
      const [nextX, nextY] = args.slice(offset, offset + 2) as [
        number | undefined,
        number | undefined
      ]
      if (typeof nextX === 'number' && typeof nextY === 'number') {
        const width = Math.abs(nextX - x)
        const height = Math.abs(nextY - y)
        if (width > 0 && height <= 1) {
          rules.push({
            orientation: 'horizontal',
            x: Math.min(x, nextX),
            y,
            length: width,
            thickness,
            colour
          })
        } else if (height > 0 && width <= 1) {
          rules.push({
            orientation: 'vertical',
            x,
            y: Math.min(y, nextY),
            length: height,
            thickness,
            colour
          })
        }
        x = nextX
        y = nextY
      }
      offset += 2
    } else if (operator === PDF_JS_RECTANGLE) {
      const [rectX, rectY, width, height] = args.slice(offset, offset + 4) as [
        number?,
        number?,
        number?,
        number?
      ]
      if (
        typeof rectX === 'number' &&
        typeof rectY === 'number' &&
        typeof width === 'number' &&
        typeof height === 'number'
      ) {
        if (width > 0) {
          rules.push({
            orientation: 'horizontal',
            x: rectX,
            y: rectY,
            length: width,
            thickness,
            colour
          })
          rules.push({
            orientation: 'horizontal',
            x: rectX,
            y: rectY + height,
            length: width,
            thickness,
            colour
          })
        }
        if (height > 0) {
          rules.push({
            orientation: 'vertical',
            x: rectX,
            y: rectY,
            length: height,
            thickness,
            colour
          })
          rules.push({
            orientation: 'vertical',
            x: rectX + width,
            y: rectY,
            length: height,
            thickness,
            colour
          })
        }
      }
      offset += 4
    }
  }
  return rules
}

function extractVisualRules(
  operatorList: { fnArray: readonly number[]; argsArray?: readonly unknown[] } | undefined
): PageVisualRule[] {
  if (!operatorList?.argsArray) return []
  const rules: PageVisualRule[] = []
  let thickness = 1
  let colour: string | undefined
  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operator = operatorList.fnArray[index]
    const args = Array.isArray(operatorList.argsArray[index])
      ? (operatorList.argsArray[index] as readonly unknown[])
      : []
    if (operator === PDF_JS_LINE_WIDTH && typeof args[0] === 'number') {
      thickness = Math.max(0.1, args[0])
    } else if (operator === PDF_JS_STROKE_RGB) {
      colour = rgbHex(args)
    } else if (
      operator === PDF_JS_CONSTRUCT_PATH &&
      PDF_JS_STROKE_OPERATORS.has(operatorList.fnArray[index + 1] ?? -1)
    ) {
      rules.push(...visualRulesFromPath(numbers(args[0]), numbers(args[1]), thickness, colour))
    }
  }
  return rules
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
      imageObjectCount: operatorList ? countImageOperators(operatorList.fnArray) : 0,
      ...(operatorList ? { visualRules: extractVisualRules(operatorList) } : {})
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
