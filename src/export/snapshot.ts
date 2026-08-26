import type { ProjectEntry, ProjectState, SourceRegion } from '../shared/contracts'
import type { ExportEntry, ExportOptions, ExportSnapshot } from './types'

function cloneRegion(region: SourceRegion): SourceRegion {
  return { ...region, ...(region.bbox ? { bbox: { ...region.bbox } } : {}) }
}

function compareEntries(left: ProjectEntry, right: ProjectEntry): number {
  const leftRegion = left.regions[0]
  const rightRegion = right.regions[0]
  return (
    (leftRegion?.documentId ?? '').localeCompare(rightRegion?.documentId ?? '') ||
    (leftRegion?.pageNumber ?? 0) - (rightRegion?.pageNumber ?? 0) ||
    (rightRegion?.bbox?.y ?? 0) - (leftRegion?.bbox?.y ?? 0) ||
    (leftRegion?.bbox?.x ?? 0) - (rightRegion?.bbox?.x ?? 0) ||
    left.id.localeCompare(right.id)
  )
}

function cloneEntry(entry: ProjectEntry): ExportEntry {
  return {
    ...entry,
    regions: entry.regions.map(cloneRegion),
    tags: [...entry.tags].sort()
  }
}

function entriesByStatus(project: ProjectState, status: ProjectEntry['status']): ExportEntry[] {
  return project.entries
    .filter((entry) => entry.status === status)
    .sort(compareEntries)
    .map(cloneEntry)
}

export function buildExportSnapshot(
  project: ProjectState,
  options: ExportOptions = {}
): ExportSnapshot {
  const kept = entriesByStatus(project, 'keep')
  const maybe = entriesByStatus(project, 'maybe')
  const excluded = entriesByStatus(project, 'exclude')
  return {
    exportSchemaVersion: 1,
    project: {
      id: project.id,
      name: project.name,
      schemaVersion: project.schemaVersion,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    },
    documents: [...project.documents]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((document) => ({
        id: document.id,
        name: document.name,
        ...(document.pageCount === undefined ? {} : { pageCount: document.pageCount }),
        ...(document.kind === undefined ? {} : { kind: document.kind })
      })),
    sections: {
      kept,
      maybe,
      ...(options.includeExcluded ? { excluded } : {})
    },
    summary: {
      documentCount: project.documents.length,
      keptCount: kept.length,
      maybeCount: maybe.length,
      excludedCount: excluded.length
    }
  }
}
