import type { ExtractedTextBlock, ParsedPage, PdfTextItem, TextLayerPageInput } from './types'

function requirePositiveNumber(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} must be a positive number.`)
}

function normalizeItem(item: PdfTextItem): Omit<ExtractedTextBlock, 'id' | 'readingOrder'> | null {
  const text = item.str.replace(/\s+/g, ' ').trim()
  if (text.length === 0) return null

  const x = item.transform[4]
  const baseline = item.transform[5]
  const width = Math.max(0, item.width)
  const height = Math.max(0, item.height || Math.abs(item.transform[3]))
  const ascentRatio = Number.isFinite(item.fontAscentRatio) ? item.fontAscentRatio! : 0.8
  if (![x, baseline, width, height, ascentRatio].every(Number.isFinite)) return null

  return {
    documentId: '',
    pageNumber: 0,
    text,
    bbox: {
      x,
      y: baseline + height * ascentRatio - height,
      width,
      height,
      coordinateSpace: 'pdf-points'
    },
    confidence: 1,
    source: 'parser'
  }
}

export function parseTextLayerPage(input: TextLayerPageInput): ParsedPage {
  if (input.documentId.trim().length === 0) throw new Error('documentId is required.')
  if (!Number.isInteger(input.pageNumber) || input.pageNumber < 1) {
    throw new Error('pageNumber must be a positive integer.')
  }
  requirePositiveNumber(input.width, 'width')
  requirePositiveNumber(input.height, 'height')
  if (![0, 90, 180, 270].includes(input.rotation)) throw new Error('rotation is invalid.')

  const normalized = input.items
    .map(normalizeItem)
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .map((item) => ({ ...item, documentId: input.documentId, pageNumber: input.pageNumber }))
    .sort((left, right) => {
      const verticalDifference = right.bbox.y - left.bbox.y
      return Math.abs(verticalDifference) > 2 ? verticalDifference : left.bbox.x - right.bbox.x
    })

  const blocks = normalized.map((item, readingOrder): ExtractedTextBlock => ({
    ...item,
    id: `${input.documentId}:p${input.pageNumber}:b${readingOrder + 1}`,
    readingOrder
  }))

  return {
    documentId: input.documentId,
    pageNumber: input.pageNumber,
    width: input.width,
    height: input.height,
    rotation: input.rotation,
    blocks,
    characterCount: blocks.reduce((total, block) => total + block.text.length, 0),
    imageObjectCount: Math.max(0, Math.trunc(input.imageObjectCount ?? 0))
  }
}
