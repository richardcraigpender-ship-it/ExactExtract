import type { ProjectEntry, SourceRegion } from '../shared/contracts'
import type { CurrencyCode } from '../shared/currencies'

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
  size: number
  importedAt: string
  pageCount?: number
  removedPages?: number[]
  kind?: string
  metadata?: {
    textPageCount: number
    imagePageCount: number
    mixedPageCount: number
    rotatedPageCount: number
    averageCharactersPerPage: number
    styleProfile?: {
      id: string
      generatedAt: string
      confidence: string
      source: string
      textStyleCount: number
      dividerStyleCount: number
      colourCount: number
      warningCount: number
    }
  }
}

export interface ExportSnapshot {
  exportSchemaVersion: 1
  project: {
    id: string
    name: string
    schemaVersion: number
    createdAt: string
    updatedAt: string
    currencyCode: CurrencyCode
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
