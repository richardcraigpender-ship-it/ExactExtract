import assert from 'node:assert/strict'
import test from 'node:test'

import { PROJECT_SCHEMA_VERSION, type ProjectEntry, type ProjectState } from '../shared/contracts'
import { exportProjectCsv } from './csv'
import { exportProjectJson } from './json'
import { buildExportSnapshot } from './snapshot'

function entry(
  id: string,
  status: ProjectEntry['status'],
  text: string,
  pageNumber: number
): ProjectEntry {
  return {
    id,
    rawText: text,
    normalizedText: text,
    source: 'parser',
    status,
    confidence: 0.91,
    regions: [
      {
        documentId: 'document-1',
        pageNumber,
        bbox: { x: 40, y: 700, width: 120, height: 12, coordinateSpace: 'pdf-points' }
      }
    ],
    notes: id === 'keep-1' ? 'Quoted "note", line\ntwo' : undefined,
    tags: ['zeta', 'café'],
    createdAt: '2026-08-16T10:00:00.000Z',
    updatedAt: '2026-08-16T11:00:00.000Z'
  }
}

function project(): ProjectState {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: 'project-1',
    name: 'Résumé review',
    createdAt: '2026-08-16T09:00:00.000Z',
    updatedAt: '2026-08-16T12:00:00.000Z',
    documents: [
      {
        id: 'document-1',
        path: 'C:\\private\\source.pdf',
        name: 'source.pdf',
        size: 100,
        pageCount: 3,
        importedAt: '2026-08-16T09:00:00.000Z'
      }
    ],
    pages: [],
    entries: [
      entry('maybe-1', 'maybe', 'Needs review', 2),
      entry('exclude-1', 'exclude', 'Private', 3),
      entry('keep-1', 'keep', 'München, "Total"', 1)
    ],
    preflight: [],
    extractionJobs: [],
    auditTrail: [],
    settings: {
      theme: 'system',
      extraction: { mode: 'balanced', ocrLanguages: ['eng'] },
      splitPanePercent: 50
    }
  }
}

test('builds immutable kept/maybe snapshots without leaking source paths', () => {
  const source = project()
  const snapshot = buildExportSnapshot(source)

  assert.deepEqual(
    snapshot.sections.kept.map((item) => item.id),
    ['keep-1']
  )
  assert.deepEqual(
    snapshot.sections.maybe.map((item) => item.id),
    ['maybe-1']
  )
  assert.equal(snapshot.sections.excluded, undefined)
  assert.equal(snapshot.summary.excludedCount, 1)
  assert.equal(JSON.stringify(snapshot).includes('C:\\private'), false)

  snapshot.sections.kept[0]!.tags.push('changed')
  if (snapshot.sections.kept[0]!.regions[0]?.bbox) {
    snapshot.sections.kept[0]!.regions[0].bbox.x = 999
  }
  assert.deepEqual(source.entries[2]?.tags, ['zeta', 'café'])
  assert.equal(source.entries[2]?.regions[0]?.bbox?.x, 40)
})

test('exports deterministic Unicode CSV with correct quoting and traceability', () => {
  const source = project()
  const first = exportProjectCsv(source)
  const second = exportProjectCsv(source)

  assert.equal(first, second)
  assert.match(first, /München/)
  assert.match(first, /"München, ""Total"""/)
  assert.match(first, /"Quoted ""note"", line\ntwo"/)
  assert.match(first, /document-1/)
  assert.match(first, /pdf-points/)
  assert.doesNotMatch(first, /Private/)
})

test('exports deterministic JSON with optional excluded separation and traceability', () => {
  const source = project()
  const first = exportProjectJson(source, { includeExcluded: true })
  const second = exportProjectJson(source, { includeExcluded: true })
  const parsed = JSON.parse(first) as ReturnType<typeof buildExportSnapshot>

  assert.equal(first, second)
  assert.deepEqual(
    parsed.sections.kept.map((item) => item.id),
    ['keep-1']
  )
  assert.deepEqual(
    parsed.sections.maybe.map((item) => item.id),
    ['maybe-1']
  )
  assert.deepEqual(
    parsed.sections.excluded?.map((item) => item.id),
    ['exclude-1']
  )
  assert.equal(parsed.sections.kept[0]?.regions[0]?.pageNumber, 1)
  assert.equal(parsed.exportSchemaVersion, 1)
})
