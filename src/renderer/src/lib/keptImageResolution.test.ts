import assert from 'node:assert/strict'
import test from 'node:test'

import { PROJECT_SCHEMA_VERSION, type ProjectState } from '../../../shared/contracts'
import type { KeptEntriesCanvasLayout, KeptImagePlacement } from '../../../shared/keptEntriesLayout'
import { getProjectImageUrl } from '../../../shared/projectImages'
import {
  collectKeptImageRefs,
  keptImageBalanceRef,
  loadKeptSessionImageUrls,
  resolveKeptImageDataUrls,
  resolveKeptImageUrl
} from './keptImageResolution'

const managedRef = `${'a'.repeat(64)}.png`

function project(): ProjectState {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: 'project-1',
    name: 'Preview',
    createdAt: '2026-08-29T09:00:00.000Z',
    updatedAt: '2026-08-29T10:00:00.000Z',
    documents: [],
    pages: [],
    entries: [],
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

function image(
  id: string,
  kind: 'session-entry' | 'uploaded-png',
  ref: string
): KeptImagePlacement {
  return {
    id,
    source: { kind, ref },
    entryId: kind === 'session-entry' ? ref : undefined,
    pageNumber: 1,
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    fit: 'contain'
  }
}

function layout(images: KeptImagePlacement[]): KeptEntriesCanvasLayout {
  return {
    version: 2,
    pageSize: 'letter',
    orientation: 'portrait',
    placements: [],
    images
  }
}

const readPdf = async (): Promise<Uint8Array> => new Uint8Array()

test('collects unique refs per source kind', () => {
  const value = layout([
    image('one', 'session-entry', 'entry-b'),
    image('two', 'session-entry', 'entry-a'),
    image('three', 'session-entry', 'entry-a'),
    image('four', 'uploaded-png', managedRef)
  ])

  assert.deepEqual(collectKeptImageRefs(value, 'session-entry'), ['entry-a', 'entry-b'])
  assert.deepEqual(collectKeptImageRefs(value, 'uploaded-png'), [managedRef])
  assert.deepEqual(collectKeptImageRefs(undefined, 'session-entry'), [])
})

test('resolves managed uploads to the privileged protocol url and session crops from the map', () => {
  const sessionUrls = new Map([['entry-a', 'data:image/png;base64,AAA']])

  assert.equal(
    resolveKeptImageUrl({ kind: 'uploaded-png', ref: managedRef }, sessionUrls),
    getProjectImageUrl(managedRef)
  )
  assert.equal(
    resolveKeptImageUrl({ kind: 'session-entry', ref: 'entry-a' }, sessionUrls),
    'data:image/png;base64,AAA'
  )
})

test('leaves unresolvable sources undefined so the canvas keeps a placeholder', () => {
  const sessionUrls = new Map<string, string>()

  assert.equal(
    resolveKeptImageUrl({ kind: 'session-entry', ref: 'missing' }, sessionUrls),
    undefined
  )
  assert.equal(
    resolveKeptImageUrl({ kind: 'uploaded-png', ref: '../escape.png' }, sessionUrls),
    undefined
  )
  assert.equal(
    resolveKeptImageUrl({ kind: 'uploaded-png', ref: 'not-a-digest.png' }, sessionUrls),
    undefined
  )
})

test('regenerates only the requested session crops', async () => {
  const result = await loadKeptSessionImageUrls(project(), ['entry-a'], readPdf, async () => [
    { name: 'a.png', content: 'AAA', entryId: 'entry-a' },
    { name: 'b.png', content: 'BBB', entryId: 'entry-b' }
  ])

  assert.deepEqual([...result.urls], [['entry-a', 'data:image/png;base64,AAA']])
  assert.equal(result.error, undefined)
})

test('reports generation failure instead of throwing', async () => {
  const result = await loadKeptSessionImageUrls(project(), ['entry-a'], readPdf, () =>
    Promise.reject(new Error('Source document is unavailable.'))
  )

  assert.equal(result.urls.size, 0)
  assert.equal(result.error, 'Source document is unavailable.')
})

test('skips generation entirely when no session image is referenced', async () => {
  let called = false
  const result = await loadKeptSessionImageUrls(project(), [], readPdf, async () => {
    called = true
    return []
  })

  assert.equal(called, false)
  assert.equal(result.urls.size, 0)
})

test('export resolution merges managed storage reads with session crops', async () => {
  const requested: string[][] = []
  const studio = {
    projectImages: {
      readDataUrls: async (refs: string[]) => {
        requested.push(refs)
        return { [managedRef]: 'data:image/png;base64,MANAGED' }
      }
    }
  }
  const restore = globalThis.window
  ;(globalThis as { window?: unknown }).window = studio ? { studio } : undefined

  try {
    const resolved = await resolveKeptImageDataUrls(
      project(),
      layout([image('one', 'uploaded-png', managedRef), image('two', 'session-entry', 'entry-a')]),
      readPdf,
      async () => [{ name: 'a.png', content: 'AAA', entryId: 'entry-a' }]
    )

    assert.deepEqual(requested, [[managedRef]])
    assert.deepEqual(
      [...resolved].sort(),
      [
        [managedRef, 'data:image/png;base64,MANAGED'],
        ['entry-a', 'data:image/png;base64,AAA']
      ].sort()
    )
  } finally {
    ;(globalThis as { window?: unknown }).window = restore
  }
})

test('a missing managed image simply stays unresolved', async () => {
  const restore = globalThis.window
  ;(globalThis as { window?: unknown }).window = {
    studio: { projectImages: { readDataUrls: async () => ({}) } }
  }

  try {
    const resolved = await resolveKeptImageDataUrls(
      project(),
      layout([image('one', 'uploaded-png', managedRef)]),
      readPdf
    )

    assert.equal(resolved.size, 0)
  } finally {
    ;(globalThis as { window?: unknown }).window = restore
  }
})

test('renders a running-balance PNG label for each image and keys it to its placement', async () => {
  const withBalances = layout([
    { ...image('one', 'session-entry', 'entry-a'), runningBalanceText: '£120.00' },
    { ...image('two', 'session-entry', 'entry-b'), runningBalanceText: '£90.00' }
  ])
  withBalances.imagePlacementOptions = {
    sourceMode: 'session-entry',
    startX: 0,
    startY: 0,
    fillBetweenY: false,
    entriesPerPage: 6,
    gap: 12,
    preserveAspectRatio: true,
    uniformSlots: false,
    runningBalance: { enabled: true, offsetX: 8, offsetY: 4, fontSize: 10, color: '#17231c' }
  }
  const rendered: Array<{ text: string; fontSize: number; color: string }> = []

  const resolved = await resolveKeptImageDataUrls(
    project(),
    withBalances,
    readPdf,
    async () => [
      { name: 'a.png', content: 'AAA', entryId: 'entry-a' },
      { name: 'b.png', content: 'BBB', entryId: 'entry-b' }
    ],
    (text, options) => {
      rendered.push({ text, ...options })
      return { dataUrl: `data:image/png;base64,LABEL-${text}`, width: 40, height: 14 }
    }
  )

  assert.deepEqual(rendered.map((entry) => entry.text).sort(), ['£120.00', '£90.00'].sort())
  assert.equal(resolved.get(keptImageBalanceRef('one')), 'data:image/png;base64,LABEL-£120.00')
  assert.equal(resolved.get(keptImageBalanceRef('two')), 'data:image/png;base64,LABEL-£90.00')
})

test('skips balance-label rendering when running balance is disabled or text is missing', async () => {
  const noRunningBalance = layout([
    { ...image('one', 'session-entry', 'entry-a'), runningBalanceText: '£120.00' }
  ])
  const noText = layout([image('two', 'session-entry', 'entry-a')])
  noText.imagePlacementOptions = {
    sourceMode: 'session-entry',
    startX: 0,
    startY: 0,
    fillBetweenY: false,
    entriesPerPage: 6,
    gap: 12,
    preserveAspectRatio: true,
    uniformSlots: false,
    runningBalance: { enabled: true, offsetX: 8, offsetY: 4, fontSize: 10, color: '#17231c' }
  }
  let called = false
  const renderBalanceLabel = (): undefined => {
    called = true
    return undefined
  }

  await resolveKeptImageDataUrls(
    project(),
    noRunningBalance,
    readPdf,
    async () => [{ name: 'a.png', content: 'AAA', entryId: 'entry-a' }],
    renderBalanceLabel
  )
  assert.equal(called, false)

  await resolveKeptImageDataUrls(
    project(),
    noText,
    readPdf,
    async () => [{ name: 'a.png', content: 'AAA', entryId: 'entry-a' }],
    renderBalanceLabel
  )
  assert.equal(called, false)
})
