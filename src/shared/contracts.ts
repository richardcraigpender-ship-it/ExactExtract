import type { KeptEntriesCanvasLayout } from './keptEntriesLayout'

export const PROJECT_SCHEMA_VERSION = 1 as const

export type ProjectSchemaVersion = typeof PROJECT_SCHEMA_VERSION
export type ReviewStatus = 'keep' | 'exclude' | 'maybe'
export type ExtractionSource = 'parser' | 'ocr' | 'merged'
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
  keptEntriesLayout?: KeptEntriesCanvasLayout
  settings: ProjectSettings
}

export interface RecentProject {
  id: string
  name: string
  path: string
  updatedAt: string
}
