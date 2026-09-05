import type { KeptEntriesCanvasLayout } from './keptEntriesLayout'
import type { KeptExportTemplate } from './keptExportTemplate'
import type { CurrencyCode } from './currencies'
import type { LengthUnit } from './units'

export const PROJECT_SCHEMA_VERSION = 1 as const

export type ProjectSchemaVersion = typeof PROJECT_SCHEMA_VERSION
export type ReviewStatus = 'keep' | 'exclude' | 'maybe'
export type ExtractionSource = 'parser' | 'ocr' | 'merged'
export type ProjectEntryOrigin = 'imported' | 'manual' | 'scenario'
export type EntryDirection = 'in' | 'out'
export type ExtractionMode = 'fast' | 'balanced' | 'maximum' | 'custom'
export type DocumentKind =
  'report' | 'invoice' | 'statistical' | 'financial' | 'tabular' | 'mixed' | 'unknown'
export type PageKind = 'text' | 'image' | 'mixed' | 'sparse' | 'rotated' | 'unknown'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
  coordinateSpace: 'pdf-points' | 'normalized'
}

export interface SourceRegion {
  id?: string
  documentId: string
  pageNumber: number
  bbox?: BoundingBox
  blockId?: string
  tableId?: string
  rowIndex?: number
}

export interface ProjectDocument {
  id: string
  path: string
  name: string
  size: number
  pageCount?: number
  removedPages?: number[]
  kind?: DocumentKind
  styleProfile?: DocumentStyleProfile
  importedAt: string
}

export interface ProjectPage {
  documentId: string
  pageNumber: number
  width: number
  height: number
  rotation: 0 | 90 | 180 | 270
  kind: PageKind
  confidence?: number
}

export type DocumentStyleConfidence = 'high' | 'medium' | 'low'
export type DocumentStyleSource = 'pdf-text' | 'ocr-image' | 'mixed'
export type TextStyleRole = 'header' | 'body' | 'footer' | 'table' | 'small-print' | 'unknown'
export type TextStyleWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'unknown'
export type DividerStyleRole =
  'table-rule' | 'section-divider' | 'underline' | 'margin-rule' | 'unknown'

export interface StyleColour {
  hex: string
  name: string
}

export interface TextStyleCluster {
  id: string
  fontFamily: string
  fontFace?: string
  /** Original PDF.js font metadata when available. */
  embeddedFontName?: string
  postscriptName?: string
  fontStyle?: string
  embedded?: boolean
  fontSize: number
  fontWeight: TextStyleWeight
  italic: boolean
  underline: boolean | 'inferred'
  colour?: StyleColour
  role?: TextStyleRole
  likelyRole: TextStyleRole
  occurrenceCount: number
  characterCount: number
  pageNumbers: number[]
  sampleText: string[]
}

export interface DividerStyleCluster {
  id: string
  orientation: 'horizontal' | 'vertical'
  thickness: number
  averageLength: number
  colour?: StyleColour
  likelyRole: DividerStyleRole
  occurrenceCount: number
  pageNumbers: number[]
}

export interface ColourCluster {
  hex: string
  name: string
  occurrenceCount: number
  likelyRole: 'text' | 'divider' | 'background' | 'unknown'
}

export interface PageStyleSummary {
  pageNumber: number
  textStyleClusterIds: string[]
  dominantTextStyleId?: string
  imageObjectCount: number
  characterCount: number
}

export interface DocumentStyleWarning {
  code:
    | 'no-text'
    | 'missing-font-name'
    | 'missing-colour'
    | 'image-only'
    | 'partial-profile'
    | 'missing-operator-list'
  pageNumber?: number
  message: string
}

export interface DocumentStyleProfile {
  id: string
  documentId: string
  generatedAt: string
  detectorVersion: 1
  source: DocumentStyleSource
  confidence: DocumentStyleConfidence
  textStyles: TextStyleCluster[]
  dividerStyles: DividerStyleCluster[]
  colourPalette: ColourCluster[]
  pageSummaries: PageStyleSummary[]
  warnings: DocumentStyleWarning[]
}

export interface ProjectEntry {
  id: string
  rawText: string
  normalizedText: string
  payee?: string
  source: ExtractionSource
  status: ReviewStatus
  confidence: number
  regions: SourceRegion[]
  category?: string
  numericValue?: number
  totalContribution?: number
  runningTotal?: number
  date?: string
  notes?: string
  tags: string[]
  createdAt: string
  updatedAt: string
  /** Imported entries omit this for backwards compatibility; new rows should set it explicitly. */
  origin?: ProjectEntryOrigin
  merchantId?: string
  direction?: EntryDirection
  sourceReference?: SourceRegion
  scenarioSeed?: number
}

export interface PagePreflightResult {
  pageNumber: number
  kind: PageKind
  characterCount: number
  confidence: number
  ocrRecommended: boolean
  rotation: 0 | 90 | 180 | 270
}

export interface DocumentPreflightResult {
  documentId: string
  kind: DocumentKind
  confidence: number
  pages: PagePreflightResult[]
  completedAt: string
}

export interface ExtractionSettings {
  mode: ExtractionMode
  ocrLanguages: string[]
  selectedPages?: number[]
}

export type ExtractionJobStatus = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed'

export interface ExtractionJob {
  id: string
  documentIds: string[]
  settings: ExtractionSettings
  status: ExtractionJobStatus
  progress: number
  startedAt?: string
  completedAt?: string
  error?: string
}

export interface AuditEvent {
  id: string
  occurredAt: string
  action: string
  entityType: 'project' | 'document' | 'entry' | 'analysis' | 'export'
  entityId: string
  details?: Record<string, string | number | boolean | null>
}

export interface ProjectSettings {
  theme: 'light' | 'dark' | 'system'
  extraction: ExtractionSettings
  splitPanePercent: number
  currencyCode?: CurrencyCode
  /** Display unit for coordinates and sizes. Stored values stay in PDF points regardless. */
  lengthUnit?: LengthUnit
}

export interface ProjectState {
  schemaVersion: ProjectSchemaVersion
  id: string
  name: string
  createdAt: string
  updatedAt: string
  documents: ProjectDocument[]
  pages: ProjectPage[]
  entries: ProjectEntry[]
  preflight: DocumentPreflightResult[]
  extractionJobs: ExtractionJob[]
  auditTrail: AuditEvent[]
  styleProfiles?: DocumentStyleProfile[]
  keptEntriesLayout?: KeptEntriesCanvasLayout
  keptExportTemplate?: KeptExportTemplate
  settings: ProjectSettings
}

export interface RecentProject {
  id: string
  name: string
  path: string
  updatedAt: string
}
