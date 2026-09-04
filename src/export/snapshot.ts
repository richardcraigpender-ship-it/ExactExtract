import type { ProjectEntry, ProjectState, SourceRegion } from '../shared/contracts'
import { resolveCurrencyCode } from '../shared/currencies'
import { formatCurrencyAmount } from '../shared/currencyFormat'
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

function cloneEntry(
  entry: ProjectEntry,
  currencyCode: ReturnType<typeof resolveCurrencyCode>
): ExportEntry {
  return {
    ...entry,
    normalizedText:
      entry.numericValue === undefined
        ? entry.normalizedText
        : formatCurrencyAmount(entry.numericValue, currencyCode),
    regions: entry.regions.map(cloneRegion),
    tags: [...entry.tags].sort()
  }
}

function entriesByStatus(
  project: ProjectState,
  status: ProjectEntry['status'],
  currencyCode: ReturnType<typeof resolveCurrencyCode>,
  includeScenario: boolean
): ExportEntry[] {
  return project.entries
    .filter(
      (entry) =>
        entry.status === status && (includeScenario || (entry.origin ?? 'imported') !== 'scenario')
    )
    .sort(compareEntries)
    .map((entry) => cloneEntry(entry, currencyCode))
}

function documentMetadata(
  project: ProjectState,
  documentId: string
): ExportSnapshot['documents'][number]['metadata'] | undefined {
  const pages = project.pages.filter((page) => page.documentId === documentId)
  const preflight = project.preflight.find((candidate) => candidate.documentId === documentId)
  const sourcePages = preflight?.pages ?? pages
  const styleProfile =
    project.documents.find((document) => document.id === documentId)?.styleProfile ??
    project.styleProfiles?.find((profile) => profile.documentId === documentId)
  if (sourcePages.length === 0 && !styleProfile) return undefined
  const characterCounts = preflight?.pages.map((page) => page.characterCount) ?? []
  return {
    textPageCount: sourcePages.filter((page) => page.kind === 'text').length,
    imagePageCount: sourcePages.filter((page) => page.kind === 'image').length,
    mixedPageCount: sourcePages.filter((page) => page.kind === 'mixed').length,
    rotatedPageCount: sourcePages.filter((page) => page.kind === 'rotated').length,
    averageCharactersPerPage:
      characterCounts.length === 0
        ? 0
        : Math.round(
            characterCounts.reduce((sum, count) => sum + count, 0) / characterCounts.length
          ),
    ...(styleProfile
      ? {
          styleProfile: {
            id: styleProfile.id,
            generatedAt: styleProfile.generatedAt,
            confidence: styleProfile.confidence,
            source: styleProfile.source,
            textStyleCount: styleProfile.textStyles.length,
            dividerStyleCount: styleProfile.dividerStyles.length,
            colourCount: styleProfile.colourPalette.length,
            warningCount: styleProfile.warnings.length
          }
        }
      : {})
  }
}

export function buildExportSnapshot(
  project: ProjectState,
  options: ExportOptions = {}
): ExportSnapshot {
  const currencyCode = resolveCurrencyCode(project.settings.currencyCode)
  const includeScenario = options.includeScenario === true
  const kept = entriesByStatus(project, 'keep', currencyCode, includeScenario)
  const maybe = entriesByStatus(project, 'maybe', currencyCode, includeScenario)
  const excluded = entriesByStatus(project, 'exclude', currencyCode, includeScenario)
  return {
    exportSchemaVersion: 1,
    project: {
      id: project.id,
      name: project.name,
      schemaVersion: project.schemaVersion,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      currencyCode
    },
    documents: [...project.documents]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((document) => {
        const metadata = documentMetadata(project, document.id)
        return {
          id: document.id,
          name: document.name,
          size: document.size,
          importedAt: document.importedAt,
          ...(document.pageCount === undefined ? {} : { pageCount: document.pageCount }),
          ...(document.removedPages === undefined
            ? {}
            : { removedPages: [...document.removedPages] }),
          ...(document.kind === undefined ? {} : { kind: document.kind }),
          ...(metadata ? { metadata } : {})
        }
      }),
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
