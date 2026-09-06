import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import type { KeptEntriesCanvasLayout } from '../shared/keptEntriesLayout'
import {
  buildSessionKeptImageSources,
  planKeptEntryImagePlacements,
  withKeptImagePlacements,
  type KeptImagePlanOptions,
  type KeptImageSourceDescriptor
} from './keptImageLayout'

function source(ref: string, naturalWidth = 200, naturalHeight = 100): KeptImageSourceDescriptor {
  return { kind: 'uploaded-png', ref, name: `${ref}.png`, naturalWidth, naturalHeight }
}

function options(overrides: Partial<KeptImagePlanOptions> = {}): KeptImagePlanOptions {
  return {
    pageSize: 'letter',
    orientation: 'portrait',
    startX: 48,
    startY: 60,
    gap: 10,
    entriesPerPage: 3,
    ...overrides
  }
}

function entry(id: string, width: number, height: number): ProjectEntry {
  return {
    id,
    rawText: id,
    normalizedText: id,
    source: 'parser',
    status: 'keep',
    confidence: 1,
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x: 20, y: 300, width, height, coordinateSpace: 'pdf-points' }
      }
    ],
    date: '2026-03-26',
    tags: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z'
  }
}

test('stacks a single page vertically from the configured origin and gap', () => {
  const plan = planKeptEntryImagePlacements(
    [source('a'), source('b'), source('c')],
    options({ width: 300 })
  )

  assert.equal(plan.pageCount, 1)
  assert.equal(plan.warnings.length, 0)
  assert.deepEqual(
    plan.placements.map((placement) => [placement.pageNumber, placement.x, placement.y]),
    [
      [1, 48, 60],
      [1, 48, 220],
      [1, 48, 380]
    ]
  )
  assert.deepEqual(
    plan.placements.map((placement) => [placement.width, placement.height]),
    [
      [300, 150],
      [300, 150],
      [300, 150]
    ]
  )
})

test('starts a continuation page once the entries-per-page count is reached', () => {
  const plan = planKeptEntryImagePlacements(
    ['a', 'b', 'c', 'd', 'e'].map((ref) => source(ref)),
    options({ entriesPerPage: 2, width: 200, gap: 20 })
  )

  assert.equal(plan.pageCount, 3)
  assert.deepEqual(
    plan.placements.map((placement) => [placement.id, placement.pageNumber, placement.y]),
    [
      ['kept-image-1', 1, 60],
      ['kept-image-2', 1, 180],
      ['kept-image-3', 2, 60],
      ['kept-image-4', 2, 180],
      ['kept-image-5', 3, 60]
    ]
  )
})

test('fills the configured Y range before continuing on the next page', () => {
  const plan = planKeptEntryImagePlacements(
    ['a', 'b', 'c', 'd'].map((ref) => source(ref, 200, 100)),
    options({ entriesPerPage: 10, startY: 60, endY: 280, fillBetweenY: true, gap: 20 })
  )

  assert.equal(plan.pageCount, 2)
  assert.deepEqual(
    plan.placements.map((placement) => [placement.pageNumber, placement.y]),
    [
      [1, 60],
      [1, 180],
      [2, 60],
      [2, 180]
    ]
  )
})

test('reports an invalid Y range and uses the configured page capacity instead', () => {
  const plan = planKeptEntryImagePlacements(
    [source('a'), source('b')],
    options({ startY: 100, endY: 100, fillBetweenY: true, entriesPerPage: 1 })
  )

  assert.equal(plan.warnings[0]?.code, 'invalid-y-range')
  assert.deepEqual(
    plan.placements.map((placement) => placement.pageNumber),
    [1, 2]
  )
})

test('derives missing dimensions from the natural aspect ratio and preserves it by default', () => {
  const widthOnly = planKeptEntryImagePlacements([source('a', 400, 100)], options({ width: 200 }))
  const heightOnly = planKeptEntryImagePlacements([source('a', 400, 100)], options({ height: 50 }))
  const natural = planKeptEntryImagePlacements([source('a', 400, 100)], options())

  assert.deepEqual([widthOnly.placements[0].width, widthOnly.placements[0].height], [200, 50])
  assert.deepEqual([heightOnly.placements[0].width, heightOnly.placements[0].height], [200, 50])
  assert.deepEqual([natural.placements[0].width, natural.placements[0].height], [400, 100])
  assert.equal(natural.placements[0].fit, 'contain')
})

test('explicit width and height keep the slot exactly, and stretch is opt-in', () => {
  const plan = planKeptEntryImagePlacements(
    [source('a', 400, 100)],
    options({ width: 120, height: 120, preserveAspectRatio: false })
  )

  assert.deepEqual(
    [plan.placements[0].width, plan.placements[0].height, plan.placements[0].fit],
    [120, 120, 'stretch']
  )
})

test('uniform slots give every placement the largest resolved box', () => {
  const plan = planKeptEntryImagePlacements(
    [source('a', 200, 100), source('b', 100, 300)],
    options({ uniformSlots: true, gap: 0 })
  )

  assert.deepEqual(
    plan.placements.map((placement) => [placement.width, placement.height, placement.y]),
    [
      [200, 300, 60],
      [200, 300, 360]
    ]
  )
})

test('reports slots that leave the page and sources without a usable size', () => {
  const plan = planKeptEntryImagePlacements(
    [source('wide', 2000, 100), source('unknown', 0, 0)],
    options({ startX: 400 })
  )

  assert.deepEqual(
    plan.warnings.map((warning) => [warning.code, warning.ref]),
    [
      ['invalid-dimensions', 'unknown'],
      ['out-of-bounds', 'wide']
    ]
  )
  assert.equal(plan.placements.length, 1)
})

test('reports empty batches and non-positive page capacity without throwing', () => {
  const empty = planKeptEntryImagePlacements([], options())
  const capacity = planKeptEntryImagePlacements(
    [source('a'), source('b')],
    options({ entriesPerPage: 0 })
  )

  assert.deepEqual(empty, { placements: [], pageCount: 1, warnings: empty.warnings })
  assert.equal(empty.warnings[0].code, 'no-sources')
  assert.equal(capacity.warnings[0].code, 'invalid-page-capacity')
  assert.deepEqual(
    capacity.placements.map((placement) => placement.pageNumber),
    [1, 1]
  )
})

test('session sources come from the kept-entry crop pipeline with source region sizes', () => {
  const sources = buildSessionKeptImageSources([entry('first', 220, 18), entry('second', 300, 40)])

  assert.deepEqual(
    sources.map((item) => [
      item.kind,
      item.ref,
      item.entryId,
      item.naturalWidth,
      item.naturalHeight
    ]),
    [
      ['session-entry', 'first', 'first', 220, 18],
      ['session-entry', 'second', 'second', 300, 40]
    ]
  )
})

test('attaches a running balance beside session images when the balance column is enabled', () => {
  const financialEntry = (id: string, text: string): ProjectEntry => ({
    ...entry(id, 200, 40),
    rawText: text,
    normalizedText: text
  })
  const sources = [financialEntry('a', '01 Jan 2026 Coffee £5.00'), financialEntry('b', '02 Jan 2026 Books £15.00')]
    .map((item) => ({
      kind: 'session-entry' as const,
      ref: item.id,
      entryId: item.id,
      naturalWidth: 200,
      naturalHeight: 40
    }))
  const plan = planKeptEntryImagePlacements(
    sources,
    options({
      runningBalance: { enabled: true, offsetX: 8, offsetY: 4, fontSize: 10, color: '#17231c' },
      entries: [financialEntry('a', '01 Jan 2026 Coffee £5.00'), financialEntry('b', '02 Jan 2026 Books £15.00')]
    })
  )

  assert.deepEqual(
    plan.placements.map((placement) => placement.runningBalanceText?.replace(/[^0-9.-]/g, '')),
    ['-5.00', '-20.00']
  )
})

test('omits running balance text when the balance column is disabled', () => {
  const financialEntry = (id: string, text: string): ProjectEntry => ({
    ...entry(id, 200, 40),
    rawText: text,
    normalizedText: text
  })
  const plan = planKeptEntryImagePlacements(
    [{ kind: 'session-entry', ref: 'a', entryId: 'a', naturalWidth: 200, naturalHeight: 40 }],
    options({
      runningBalance: { enabled: false, offsetX: 8, offsetY: 4, fontSize: 10, color: '#17231c' },
      entries: [financialEntry('a', '01 Jan 2026 Coffee £5.00')]
    })
  )

  assert.equal(plan.placements[0]?.runningBalanceText, undefined)
})

test('session sources are empty when no kept entry has a usable region', () => {
  assert.deepEqual(buildSessionKeptImageSources([]), [])
})

test('applying a plan widens the layout version and keeps text placements', () => {
  const layout: KeptEntriesCanvasLayout = {
    version: 1,
    pageSize: 'letter',
    orientation: 'portrait',
    placements: [
      {
        id: 'text-1',
        text: 'Total',
        pageNumber: 4,
        x: 10,
        y: 10,
        width: 100,
        height: 20,
        rotation: 0,
        fontRef: { kind: 'standard-14', family: 'Helvetica' },
        fontSize: 11,
        color: '#000000'
      }
    ]
  }
  const plan = planKeptEntryImagePlacements(
    [source('a'), source('b')],
    options({ entriesPerPage: 1 })
  )
  const updated = withKeptImagePlacements(layout, plan)

  assert.equal(updated.version, 2)
  assert.equal(updated.pageCount, 4)
  assert.equal(updated.images?.length, 2)
  assert.deepEqual(updated.placements, layout.placements)
})

test('applying a plan preserves image placement options atomically', () => {
  const layout: KeptEntriesCanvasLayout = {
    version: 1,
    pageSize: 'letter',
    orientation: 'portrait',
    placements: []
  }
  const plan = planKeptEntryImagePlacements([source('a')], options({ entriesPerPage: 1 }))
  plan.options = {
    sourceMode: 'uploaded-png',
    startX: 48,
    startY: 60,
    fillBetweenY: false,
    gap: 10,
    entriesPerPage: 1,
    preserveAspectRatio: true,
    uniformSlots: false,
    divider: {
      enabled: true,
      width: 240,
      thickness: 2,
      color: '#336699',
      opacity: 0.5,
      startX: 40,
      endX: 280
    },
    runningBalance: {
      enabled: true,
      offsetX: 8,
      offsetY: 4,
      fontSize: 10,
      color: '#17231c'
    }
  }

  const updated = withKeptImagePlacements(layout, plan)

  assert.equal(updated.imagePlacementOptions?.divider?.enabled, true)
  assert.equal(updated.imagePlacementOptions?.divider?.endX, 280)
  assert.equal(updated.imagePlacementOptions?.runningBalance?.enabled, true)
  assert.equal(updated.imagePlacementOptions?.runningBalance?.offsetX, 8)
})
