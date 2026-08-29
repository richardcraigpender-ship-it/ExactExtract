import assert from 'node:assert/strict'
import test from 'node:test'
import zlib from 'node:zlib'
import { PDFDocument } from 'pdf-lib'

import { PROJECT_SCHEMA_VERSION, type ProjectEntry, type ProjectState } from '../shared/contracts'
import type { KeptEntriesCanvasLayout, KeptImagePlacement } from '../shared/keptEntriesLayout'
import {
  exportProjectKeptEntriesCanvasPdf,
  getKeptEntriesCanvasWarnings
} from './keptEntriesCanvas'

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** Minimal opaque RGB PNG so the export path embeds real image bytes. */
function pngDataUrl(width: number, height: number): string {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  const raw = Buffer.concat(
    Array.from({ length: height }, () =>
      Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x40)])
    )
  )
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
  return `data:image/png;base64,${png.toString('base64')}`
}

function entry(id: string): ProjectEntry {
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
        bbox: { x: 20, y: 300, width: 200, height: 20, coordinateSpace: 'pdf-points' }
      }
    ],
    tags: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z'
  }
}

function project(entries: ProjectEntry[]): ProjectState {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: 'project-1',
    name: 'Image Batch',
    createdAt: '2026-08-29T09:00:00.000Z',
    updatedAt: '2026-08-29T10:00:00.000Z',
    documents: [
      {
        id: 'document-1',
        path: 'source.pdf',
        name: 'source.pdf',
        size: 100,
        pageCount: 1,
        importedAt: '2026-08-29T09:00:00.000Z'
      }
    ],
    pages: [],
    entries,
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

function imagePlacement(overrides: Partial<KeptImagePlacement> = {}): KeptImagePlacement {
  return {
    id: 'kept-image-1',
    source: { kind: 'session-entry', ref: 'first' },
    entryId: 'first',
    pageNumber: 1,
    x: 48,
    y: 60,
    width: 200,
    height: 100,
    fit: 'contain',
    ...overrides
  }
}

function layout(images: KeptImagePlacement[]): KeptEntriesCanvasLayout {
  return {
    version: 2,
    pageSize: 'letter',
    orientation: 'portrait',
    placements: [],
    images,
    pageCount: Math.max(1, ...images.map((image) => image.pageNumber))
  }
}

test('embeds image placements on every planned page of a reopenable PDF', async () => {
  const images = [
    imagePlacement(),
    imagePlacement({ id: 'kept-image-2', pageNumber: 2, y: 200 }),
    imagePlacement({ id: 'kept-image-3', pageNumber: 3, fit: 'stretch' })
  ]
  const bytes = await exportProjectKeptEntriesCanvasPdf(project([entry('first')]), layout(images), {
    imageDataUrls: new Map([['first', pngDataUrl(20, 10)]])
  })
  const reopened = await PDFDocument.load(bytes)

  assert.equal(reopened.getPageCount(), 3)
  assert.deepEqual(reopened.getPage(2).getSize(), { width: 612, height: 792 })
  assert.match(reopened.getTitle() ?? '', /Kept Entries Layout/)
})

test('places text and images on their own pages and keeps version-1 layouts single page', async () => {
  const multiPage: KeptEntriesCanvasLayout = {
    ...layout([imagePlacement({ pageNumber: 2 })]),
    placements: [
      {
        id: 'text-1',
        text: 'Page four total',
        pageNumber: 4,
        x: 48,
        y: 48,
        width: 200,
        height: 20,
        rotation: 0,
        fontRef: { kind: 'standard-14', family: 'Helvetica' },
        fontSize: 11,
        color: '#17231c'
      }
    ]
  }
  const multiPageOutput = await PDFDocument.load(
    await exportProjectKeptEntriesCanvasPdf(project([entry('first')]), multiPage, {
      imageDataUrls: new Map([['first', pngDataUrl(20, 10)]])
    })
  )
  const legacyOutput = await PDFDocument.load(
    await exportProjectKeptEntriesCanvasPdf(project([entry('first')]), {
      ...multiPage,
      version: 1,
      images: undefined,
      pageCount: undefined,
      placements: multiPage.placements.map((placement) => ({ ...placement, pageNumber: undefined }))
    })
  )

  assert.equal(multiPageOutput.getPageCount(), 4)
  assert.equal(legacyOutput.getPageCount(), 1)
})

test('warns about unresolved images and out-of-bounds slots without failing the export', async () => {
  const images = [
    imagePlacement({ source: { kind: 'uploaded-png', ref: 'missing' }, entryId: undefined }),
    imagePlacement({ id: 'kept-image-2', x: 500, width: 300 })
  ]
  const warnings = getKeptEntriesCanvasWarnings(project([entry('first')]).entries, layout(images), {
    imageDataUrls: new Map([['first', pngDataUrl(20, 10)]])
  })
  const bytes = await exportProjectKeptEntriesCanvasPdf(project([entry('first')]), layout(images), {
    imageDataUrls: new Map([['first', pngDataUrl(20, 10)]])
  })

  assert.deepEqual(
    warnings.map((warning) => [warning.code, warning.placementId]),
    [
      ['missing-image', 'kept-image-1'],
      ['out-of-bounds', 'kept-image-2']
    ]
  )
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1)
})

test('an image-only layout is not reported as an empty layout', () => {
  const withImages = getKeptEntriesCanvasWarnings(
    project([entry('first')]).entries,
    layout([imagePlacement()]),
    { imageDataUrls: new Map([['first', pngDataUrl(20, 10)]]) }
  )
  const withoutAnything = getKeptEntriesCanvasWarnings(
    project([entry('first')]).entries,
    layout([])
  )

  assert.deepEqual(withImages, [])
  assert.deepEqual(
    withoutAnything.map((warning) => warning.code),
    ['empty-layout']
  )
})
