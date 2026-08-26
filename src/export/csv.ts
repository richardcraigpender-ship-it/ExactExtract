import type { ProjectState, SourceRegion } from '../shared/contracts'
import { buildExportSnapshot } from './snapshot'
import type { ExportEntry, ExportOptions } from './types'

const COLUMNS = [
  'section',
  'status',
  'id',
  'source',
  'confidence',
  'category',
  'text',
  'numeric_value',
  'date',
  'notes',
  'tags',
  'document_ids',
  'pages',
  'regions'
] as const

function escapeCsv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function stableRegion(region: SourceRegion): Record<string, unknown> {
  return {
    documentId: region.documentId,
    pageNumber: region.pageNumber,
    ...(region.bbox ? { bbox: region.bbox } : {}),
    ...(region.blockId ? { blockId: region.blockId } : {}),
    ...(region.tableId ? { tableId: region.tableId } : {}),
    ...(region.rowIndex === undefined ? {} : { rowIndex: region.rowIndex })
  }
}

function row(section: string, entry: ExportEntry): string {
  const documentIds = [...new Set(entry.regions.map((region) => region.documentId))].sort()
  const pages = [...new Set(entry.regions.map((region) => region.pageNumber))].sort(
    (left, right) => left - right
  )
  const values = [
    section,
    entry.status,
    entry.id,
    entry.source,
    String(entry.confidence),
    entry.category ?? '',
    entry.normalizedText,
    entry.numericValue === undefined ? '' : String(entry.numericValue),
    entry.date ?? '',
    entry.notes ?? '',
    entry.tags.join('|'),
    documentIds.join('|'),
    pages.join('|'),
    JSON.stringify(entry.regions.map(stableRegion))
  ]
  return values.map(escapeCsv).join(',')
}

export function exportProjectCsv(project: ProjectState, options: ExportOptions = {}): string {
  const snapshot = buildExportSnapshot(project, options)
  return [
    COLUMNS.join(','),
    ...snapshot.sections.kept.map((entry) => row('kept', entry)),
    ...snapshot.sections.maybe.map((entry) => row('maybe', entry)),
    ...(snapshot.sections.excluded ?? []).map((entry) => row('excluded', entry))
  ].join('\r\n')
}
