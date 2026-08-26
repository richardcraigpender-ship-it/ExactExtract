import type { BoundingBox } from '../shared/contracts'
import type { ExtractedLine, ExtractedTextBlock, ParsedPage } from './types'

function unionBoxes(blocks: readonly ExtractedTextBlock[]): BoundingBox {
  const left = Math.min(...blocks.map((block) => block.bbox.x))
  const bottom = Math.min(...blocks.map((block) => block.bbox.y))
  const right = Math.max(...blocks.map((block) => block.bbox.x + block.bbox.width))
  const top = Math.max(...blocks.map((block) => block.bbox.y + block.bbox.height))
  return {
    x: left,
    y: bottom,
    width: right - left,
    height: top - bottom,
    coordinateSpace: 'pdf-points'
  }
}

export function groupPageLines(page: ParsedPage, verticalTolerance = 3): ExtractedLine[] {
  if (!Number.isFinite(verticalTolerance) || verticalTolerance < 0) {
    throw new Error('verticalTolerance must be a non-negative number.')
  }

  const rows: ExtractedTextBlock[][] = []
  for (const block of page.blocks) {
    const row = rows.find(
      (candidate) => Math.abs((candidate[0]?.bbox.y ?? 0) - block.bbox.y) <= verticalTolerance
    )
    if (row) row.push(block)
    else rows.push([block])
  }

  return rows
    .map((blocks) => blocks.sort((left, right) => left.bbox.x - right.bbox.x))
    .sort((left, right) => (right[0]?.bbox.y ?? 0) - (left[0]?.bbox.y ?? 0))
    .map((blocks, readingOrder) => ({
      id: `${page.documentId}:p${page.pageNumber}:l${readingOrder + 1}`,
      documentId: page.documentId,
      pageNumber: page.pageNumber,
      blockIds: blocks.map((block) => block.id),
      text: blocks.map((block) => block.text).join(' '),
      bbox: unionBoxes(blocks),
      readingOrder
    }))
}
