import type { BoundingBox, ProjectEntry } from '../shared/contracts'

export interface OcrRecognizedBlock {
  id: string
  documentId: string
  pageNumber: number
  text: string
  confidence: number
  bbox: BoundingBox
}

function validateBoundingBox(bbox: BoundingBox): void {
  const values = [bbox.x, bbox.y, bbox.width, bbox.height]
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('OCR bounding boxes must contain finite values.')
  }
  if (bbox.x < 0 || bbox.y < 0 || bbox.width <= 0 || bbox.height <= 0) {
    throw new Error('OCR bounding boxes must have non-negative positions and positive dimensions.')
  }
  if (
    bbox.coordinateSpace === 'normalized' &&
    (bbox.x + bbox.width > 1 || bbox.y + bbox.height > 1)
  ) {
    throw new Error('Normalized OCR bounding boxes must fit within the page.')
  }
}

function compareBlocks(left: OcrRecognizedBlock, right: OcrRecognizedBlock): number {
  const verticalOrder =
    left.bbox.coordinateSpace === 'pdf-points'
      ? right.bbox.y - left.bbox.y
      : left.bbox.y - right.bbox.y
  return (
    left.pageNumber - right.pageNumber ||
    verticalOrder ||
    left.bbox.x - right.bbox.x ||
    left.id.localeCompare(right.id)
  )
}

export function projectOcrEntries(
  documentId: string,
  blocks: readonly OcrRecognizedBlock[],
  timestamp: string = new Date().toISOString()
): ProjectEntry[] {
  if (documentId.trim().length === 0) throw new Error('documentId is required.')
  if (Number.isNaN(Date.parse(timestamp))) throw new Error('timestamp must be an ISO date.')

  const blockIds = new Set<string>()
  for (const block of blocks) {
    if (block.id.trim().length === 0) throw new Error('OCR block IDs are required.')
    if (blockIds.has(block.id)) throw new Error(`Duplicate OCR block ID: ${block.id}`)
    blockIds.add(block.id)
    if (block.documentId !== documentId)
      throw new Error('All OCR blocks must belong to documentId.')
    if (!Number.isInteger(block.pageNumber) || block.pageNumber < 1) {
      throw new Error('OCR page numbers must be positive integers.')
    }
    if (block.text.trim().length === 0) throw new Error('OCR block text is required.')
    if (!Number.isFinite(block.confidence) || block.confidence < 0 || block.confidence > 1) {
      throw new Error('OCR confidence must be between 0 and 1.')
    }
    validateBoundingBox(block.bbox)
  }

  return [...blocks].sort(compareBlocks).map((block) => ({
    id: `ocr:${documentId}:p${block.pageNumber}:${block.id}:entry`,
    rawText: block.text,
    normalizedText: block.text.replace(/\s+/g, ' ').trim(),
    source: 'ocr',
    status: 'maybe',
    confidence: block.confidence,
    regions: [
      {
        documentId,
        pageNumber: block.pageNumber,
        blockId: block.id,
        bbox: { ...block.bbox }
      }
    ],
    tags: ['ocr'],
    createdAt: timestamp,
    updatedAt: timestamp
  }))
}
