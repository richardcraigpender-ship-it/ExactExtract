import type { ProjectEntry, SourceRegion } from '../shared/contracts'

export interface ExportOptions {
  includeExcluded?: boolean
}

export interface PdfMetricSummary {
  label: string
  value: number | null
  contributorCount: number
  group?: string
}

export interface PdfExportOptions extends ExportOptions {
  metrics?: PdfMetricSummary[]
}

export interface ExportEntry extends Omit<ProjectEntry, 'regions' | 'tags'> {
  regions: SourceRegion[]
  tags: string[]
}

export interface ExportDocumentSummary {
  id: string
  name: string
  pageCount?: number
  kind?: string
}

export interface ExportSnapshot {
  exportSchemaVersion: 1
  project: {
    id: string
    name: string
    schemaVersion: number
    createdAt: string
    updatedAt: string
  }
  documents: ExportDocumentSummary[]
  sections: {
    kept: ExportEntry[]
    maybe: ExportEntry[]
    excluded?: ExportEntry[]
  }
  summary: {
    documentCount: number
    keptCount: number
    maybeCount: number
    excludedCount: number
  }
}
