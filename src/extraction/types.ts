import type {
  BoundingBox,
  DocumentStyleProfile,
  DocumentKind,
  DocumentPreflightResult,
  PageKind
} from '../shared/contracts'

export type PageRotation = 0 | 90 | 180 | 270

export interface PdfTextItem {
  str: string
  transform: readonly [number, number, number, number, number, number]
  width: number
  height: number
  fontName?: string
  fontAscentRatio?: number
  hasEOL?: boolean
}

export interface PageVisualRule {
  orientation: 'horizontal' | 'vertical'
  x: number
  y: number
  length: number
  thickness: number
  colour?: string
}

export interface TextLayerPageInput {
  documentId: string
  pageNumber: number
  width: number
  height: number
  rotation: PageRotation
  items: readonly PdfTextItem[]
  imageObjectCount?: number
  visualRules?: readonly PageVisualRule[]
}

export interface ExtractedTextBlock {
  id: string
  documentId: string
  pageNumber: number
  text: string
  bbox: BoundingBox
  readingOrder: number
  confidence: number
  source: 'parser'
}

export interface ParsedPage {
  documentId: string
  pageNumber: number
  width: number
  height: number
  rotation: PageRotation
  blocks: ExtractedTextBlock[]
  characterCount: number
  imageObjectCount: number
}

export interface ClassifiedPage extends ParsedPage {
  kind: PageKind
  classificationConfidence: number
  ocrRecommended: boolean
}

export interface ExtractedLine {
  id: string
  documentId: string
  pageNumber: number
  blockIds: string[]
  text: string
  bbox: BoundingBox
  readingOrder: number
}

export type TableColumnType = 'text' | 'integer' | 'decimal' | 'currency' | 'date' | 'percentage'
export type TableColumnTotalBehavior = 'none' | 'add' | 'subtract'

export interface TableColumnDefinition {
  name: string
  type: TableColumnType
  xStart: number
  xEnd: number
  required: boolean
  totalBehavior?: TableColumnTotalBehavior
}

export interface TableTemplate {
  name: string
  headerLabels?: string[]
  columns: TableColumnDefinition[]
  topY?: number
  bottomY?: number
}

export interface TableCandidate {
  id: string
  documentId: string
  pageNumber: number
  rowLineIds: string[]
  columnCount: number
  bbox: BoundingBox
  confidence: number
  headerLineId?: string
  templateName?: string
  validatedRowLineIds?: string[]
  totalColumn?: {
    name: string
    xStart: number
    xEnd: number
    behavior: Exclude<TableColumnTotalBehavior, 'none'>
  }
}

export interface DocumentClassification {
  kind: DocumentKind
  confidence: number
  scores: Record<DocumentKind, number>
  evidence: string[]
}

export interface ParserExtractionResult {
  documentId: string
  styleProfile?: DocumentStyleProfile
  pages: ClassifiedPage[]
  blocks: ExtractedTextBlock[]
  lines: ExtractedLine[]
  tables: TableCandidate[]
  classification: DocumentClassification
  preflight: DocumentPreflightResult
}
