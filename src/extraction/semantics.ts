import type { ExtractedLine } from './types'

export type SemanticLineKind = 'heading' | 'paragraph' | 'list-item' | 'key-value'

export interface SemanticLineCandidate {
  lineId: string
  documentId: string
  pageNumber: number
  blockIds: string[]
  text: string
  kind: SemanticLineKind
  confidence: number
}

const LIST_PREFIX = /^(?:[-*\u2022]|\d+[.)]|[a-zA-Z][.)])\s+/
const KEY_VALUE = /^([^:]{1,60}):\s*(\S.*)$/
const SENTENCE_ENDING = /[.!?]["')\]]?$/

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

function classifyLine(
  line: ExtractedLine,
  medianHeight: number
): Pick<SemanticLineCandidate, 'kind' | 'confidence'> {
  const text = line.text.trim()

  if (LIST_PREFIX.test(text)) return { kind: 'list-item', confidence: 0.96 }
  if (KEY_VALUE.test(text)) return { kind: 'key-value', confidence: 0.94 }

  const words = text.split(/\s+/)
  const isShort = words.length <= 12 && text.length <= 100
  const isProminent = medianHeight > 0 && line.bbox.height >= medianHeight * 1.25
  const isTitleShaped = !SENTENCE_ENDING.test(text) && (isProminent || text === text.toUpperCase())
  if (isShort && isTitleShaped) return { kind: 'heading', confidence: isProminent ? 0.9 : 0.78 }

  return { kind: 'paragraph', confidence: 0.75 }
}

export function classifySemanticLines(lines: readonly ExtractedLine[]): SemanticLineCandidate[] {
  const medianHeight = median(
    lines.map((line) => line.bbox.height).filter((height) => Number.isFinite(height) && height > 0)
  )

  return lines.map((line) => ({
    lineId: line.id,
    documentId: line.documentId,
    pageNumber: line.pageNumber,
    blockIds: [...line.blockIds],
    text: line.text,
    ...classifyLine(line, medianHeight)
  }))
}
