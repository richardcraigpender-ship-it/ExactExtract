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
        removedPages: [3],
        kind: 'financial',
        styleProfile: {
          id: 'style-profile-1',
          documentId: 'document-1',
          generatedAt: '2026-08-16T10:00:00.000Z',
          detectorVersion: 1,
          source: 'pdf-text',
          confidence: 'high',
          textStyles: [
            {
              id: 'body-style',
              fontFamily: 'Helvetica',
              fontSize: 11,
              fontWeight: 'regular',
              italic: false,
              underline: false,
              colour: { hex: '#17231c', name: 'Text' },
              likelyRole: 'body',
              role: 'body',
              occurrenceCount: 4,
              characterCount: 80,
              pageNumbers: [1, 2],
              sampleText: ['München']
            }
          ],
          dividerStyles: [],
          colourPalette: [{ hex: '#17231c', name: 'Text', occurrenceCount: 4, likelyRole: 'text' }],
          pageSummaries: [],
          warnings: []
        },
        importedAt: '2026-08-16T09:00:00.000Z'
      }
    ],
    pages: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        width: 612,
        height: 792,
        rotation: 0,
        kind: 'text',
        confidence: 0.95
      },
      {
        documentId: 'document-1',
        pageNumber: 2,
        width: 612,
        height: 792,
        rotation: 0,
        kind: 'image',
        confidence: 0.75
      },
      {
        documentId: 'document-1',
        pageNumber: 3,
        width: 792,
        height: 612,
        rotation: 90,
        kind: 'rotated',
        confidence: 0.8
      }
    ],
    entries: [
      entry('maybe-1', 'maybe', 'Needs review', 2),
      entry('exclude-1', 'exclude', 'Private', 3),
      entry('keep-1', 'keep', 'München, "Total"', 1)
    ],
    preflight: [],
    extractionJobs: [],
    preflight: [
      {
        documentId: 'document-1',
        kind: 'financial',
        confidence: 0.9,
        completedAt: '2026-08-16T10:00:00.000Z',
        pages: [
          {
            pageNumber: 1,
            kind: 'text',
            characterCount: 100,
            confidence: 0.95,
            ocrRecommended: false,
            rotation: 0
          },
          {
            pageNumber: 2,
            kind: 'image',
            characterCount: 0,
            confidence: 0.75,
            ocrRecommended: true,
            rotation: 0
          },
          {
            pageNumber: 3,
            kind: 'rotated',
            characterCount: 50,
            confidence: 0.8,
            ocrRecommended: true,
            rotation: 90
          }
        ]
      }
    ],
    auditTrail: [],
    settings: {
      theme: 'system',
      extraction: { mode: 'balanced', ocrLanguages: ['eng'] },
      splitPanePercent: 50,
      currencyCode: 'USD'
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
  assert.equal(snapshot.project.currencyCode, 'USD')
  assert.equal(snapshot.documents[0]?.size, 100)
  assert.equal(snapshot.documents[0]?.importedAt, '2026-08-16T09:00:00.000Z')
  assert.deepEqual(snapshot.documents[0]?.removedPages, [3])
  assert.equal(snapshot.documents[0]?.metadata?.textPageCount, 1)
  assert.equal(snapshot.documents[0]?.metadata?.imagePageCount, 1)
  assert.equal(snapshot.documents[0]?.metadata?.rotatedPageCount, 1)
  assert.equal(snapshot.documents[0]?.metadata?.averageCharactersPerPage, 50)
  assert.equal(snapshot.documents[0]?.metadata?.styleProfile?.textStyleCount, 1)
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

test('keeps scenario rows out of exports unless explicitly included', () => {
  const source = project()
  source.entries.push({
    ...entry('scenario-1', 'maybe', 'Forecast merchant', 1),
    origin: 'scenario',
    merchantId: 'merchant-1',
    scenarioSeed: 7
  })

  assert.deepEqual(
    buildExportSnapshot(source).sections.maybe.map((item) => item.id),
    ['maybe-1']
  )
  assert.deepEqual(
    buildExportSnapshot(source, { includeScenario: true }).sections.maybe.map((item) => item.id),
    ['scenario-1', 'maybe-1']
  )
})
