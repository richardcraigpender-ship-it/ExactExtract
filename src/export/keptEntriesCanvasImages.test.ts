import assert from 'node:assert/strict'
import test from 'node:test'
import zlib from 'node:zlib'
import { PDFDocument } from 'pdf-lib'

import { PROJECT_SCHEMA_VERSION, type ProjectEntry, type ProjectState } from '../shared/contracts'
import type {
  KeptEntriesCanvasLayout,
  KeptImagePlacement,
  KeptImagePlacementOptions
} from '../shared/keptEntriesLayout'
import {
  exportProjectKeptEntriesCanvasPdf,
  getKeptEntriesCanvasWarnings
} from './keptEntriesCanvas'

function decodeContent(pdfBytes: Uint8Array): string {
  const raw = Buffer.from(pdfBytes)
  const streams = [...raw.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
  return streams
    .map((match) => {
      const buffer = Buffer.from(match[1], 'latin1')
      try {
        return zlib.inflateSync(buffer).toString('latin1')
      } catch {
        return buffer.toString('latin1')
      }
    })
    .join('\n')
}

/** pdf-lib writes drawn text as hex strings for embedded standard-14 fonts. */
function decodeHexText(content: string): string {
  return content.replace(/<([\da-f]+)>/gi, (_, hex: string) =>
    Buffer.from(hex, 'hex').toString('latin1')
  )
}

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

test('draws a configured divider after every placed image', async () => {
  const images = [imagePlacement(), imagePlacement({ id: 'kept-image-2', y: 220 })]
  const dividerOptions: KeptImagePlacementOptions = {
    sourceMode: 'session-entry',
    startX: 48,
    startY: 48,
    fillBetweenY: false,
    entriesPerPage: 6,
    gap: 12,
    preserveAspectRatio: true,
    uniformSlots: false,
    divider: {
      enabled: true,
      startX: 40,
      endX: 300,
      width: 260,
      thickness: 2,
      color: '#336699',
      opacity: 0.5
    }
  }

  const withDivider = await exportProjectKeptEntriesCanvasPdf(
    project([entry('first')]),
    { ...layout(images), imagePlacementOptions: dividerOptions },
    { imageDataUrls: new Map([['first', pngDataUrl(20, 10)]]) }
  )
  const withoutDivider = await exportProjectKeptEntriesCanvasPdf(
    project([entry('first')]),
    {
      ...layout(images),
      imagePlacementOptions: { ...dividerOptions, divider: undefined }
    },
    { imageDataUrls: new Map([['first', pngDataUrl(20, 10)]]) }
  )

  // Images sit at y 60 and 220 with height 100, so dividers land on the 792pt page at 632 and 472.
  const enabled = decodeContent(withDivider)
  assert.match(enabled, /40 632(\.\d+)? m/)
  assert.match(enabled, /300 632(\.\d+)? l/)
  assert.match(enabled, /40 472(\.\d+)? m/)

  assert.doesNotMatch(decodeContent(withoutDivider), /40 632(\.\d+)? m/)
})

test('draws running balance text next to each session image when enabled', async () => {
  const images = [
    imagePlacement({ runningBalanceText: '£10.00' }),
    imagePlacement({ id: 'kept-image-2', y: 220, runningBalanceText: '£30.00' })
  ]
  const options: KeptImagePlacementOptions = {
    sourceMode: 'session-entry',
    startX: 48,
    startY: 60,
    fillBetweenY: false,
    entriesPerPage: 6,
    gap: 12,
    preserveAspectRatio: true,
    uniformSlots: false,
    runningBalance: {
      enabled: true,
      offsetX: 8,
      offsetY: 4,
      fontSize: 10,
      color: '#17231c'
    }
  }

  const bytes = await exportProjectKeptEntriesCanvasPdf(
    project([entry('first')]),
    { ...layout(images), imagePlacementOptions: options },
    { imageDataUrls: new Map([['first', pngDataUrl(20, 10)]]) }
  )
  const content = decodeContent(bytes)

  assert.match(content, /<A331302E3030> Tj/)
  assert.match(content, /<A333302E3030> Tj/)
})

test('draws the running balance as an embedded PNG when one was resolved for the placement', async () => {
  const images = [imagePlacement({ runningBalanceText: '£10.00' })]
  const options: KeptImagePlacementOptions = {
    sourceMode: 'session-entry',
    startX: 48,
    startY: 60,
    fillBetweenY: false,
    entriesPerPage: 6,
    gap: 12,
    preserveAspectRatio: true,
    uniformSlots: false,
    runningBalance: {
      enabled: true,
      offsetX: 8,
      offsetY: 4,
      fontSize: 10,
      color: '#17231c'
    }
  }

  const bytes = await exportProjectKeptEntriesCanvasPdf(
    project([entry('first')]),
    { ...layout(images), imagePlacementOptions: options },
    {
      imageDataUrls: new Map([
        ['first', pngDataUrl(20, 10)],
        ['balance:kept-image-1', pngDataUrl(40, 14)]
      ])
    }
  )
  const content = decodeContent(bytes)
  const imageDrawCount = [...content.matchAll(/\/Image-?\d+ Do/g)].length

  // The balance PNG is embedded and drawn as an image, not as vector text.
  assert.equal(imageDrawCount, 2)
  assert.doesNotMatch(content, /<A331302E3030> Tj/)
})

test('does not draw running balance text when the option is disabled', async () => {
  const images = [imagePlacement({ runningBalanceText: '£10.00' })]
  const options: KeptImagePlacementOptions = {
    sourceMode: 'session-entry',
    startX: 48,
    startY: 60,
    fillBetweenY: false,
    entriesPerPage: 6,
    gap: 12,
    preserveAspectRatio: true,
    uniformSlots: false,
    runningBalance: {
      enabled: false,
      offsetX: 8,
      offsetY: 4,
      fontSize: 10,
      color: '#17231c'
    }
  }

  const bytes = await exportProjectKeptEntriesCanvasPdf(
    project([entry('first')]),
    { ...layout(images), imagePlacementOptions: options },
    { imageDataUrls: new Map([['first', pngDataUrl(20, 10)]]) }
  )
  const content = decodeContent(bytes)

  assert.doesNotMatch(content, /<A331302E3030> Tj/)
})

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

test('inherits author from the source PDF when sourceFiles is provided', async () => {
  const source = await PDFDocument.create()
  source.addPage([400, 500])
  source.setAuthor('Acme Bank plc')
  const sourceBytes = await source.save()

  const bytes = await exportProjectKeptEntriesCanvasPdf(
    project([entry('first')]),
    layout([imagePlacement()]),
    {
      imageDataUrls: new Map([['first', pngDataUrl(20, 10)]]),
      sourceFiles: new Map([['source.pdf', sourceBytes]])
    }
  )
  const reopened = await PDFDocument.load(bytes, { updateMetadata: false })

  assert.equal(reopened.getAuthor(), 'Acme Bank plc')
})

test('draws page numbers on every page when enabled on the layout', async () => {
  const withNumbers: KeptEntriesCanvasLayout = {
    ...layout([imagePlacement(), imagePlacement({ id: 'kept-image-2', pageNumber: 2, y: 200 })]),
    pageNumbers: {
      enabled: true,
      matchSourceStyle: false,
      anchor: 'bottom-center',
      offsetX: 0,
      offsetY: 24,
      format: { template: 'Page {n} of {total}', startAt: 1 },
      textStyle: {
        fontRef: { kind: 'standard-14', family: 'Helvetica' },
        fontSize: 9,
        color: '#17231c',
        fontWeight: 'normal',
        fontStyle: 'normal'
      },
      scale: 1
    }
  }
  withNumbers.images![1]!.pageNumber = 2

  const bytes = await exportProjectKeptEntriesCanvasPdf(project([entry('first')]), withNumbers, {
    imageDataUrls: new Map([['first', pngDataUrl(20, 10)]])
  })
  const content = decodeHexText(decodeContent(bytes))

  assert.match(content, /Page 1 of 2/)
  assert.match(content, /Page 2 of 2/)
})

test('does not draw page numbers when the layout has none configured', async () => {
  const bytes = await exportProjectKeptEntriesCanvasPdf(
    project([entry('first')]),
    layout([imagePlacement()]),
    { imageDataUrls: new Map([['first', pngDataUrl(20, 10)]]) }
  )
  const content = decodeHexText(decodeContent(bytes))

  assert.doesNotMatch(content, /Page 1 of/)
})

test('embeds a managed background from the resolved image map', async () => {
  const backgroundRef = `${'a'.repeat(64)}.png`
  const withBackground: KeptEntriesCanvasLayout = {
    ...layout([imagePlacement()]),
    background: { ref: backgroundRef, x: 0, y: 0, width: 612, height: 792, opacity: 1 }
  }

  const warnings = getKeptEntriesCanvasWarnings(project([entry('first')]).entries, withBackground, {
    imageDataUrls: new Map([
      ['first', pngDataUrl(20, 10)],
      [backgroundRef, pngDataUrl(40, 20)]
    ])
  })
  const bytes = await exportProjectKeptEntriesCanvasPdf(project([entry('first')]), withBackground, {
    imageDataUrls: new Map([
      ['first', pngDataUrl(20, 10)],
      [backgroundRef, pngDataUrl(40, 20)]
    ])
  })

  assert.deepEqual(warnings, [])
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1)
})

test('warns when a managed background ref has no resolved bytes', () => {
  const backgroundRef = `${'b'.repeat(64)}.png`
  const warnings = getKeptEntriesCanvasWarnings(
    project([entry('first')]).entries,
    {
      ...layout([imagePlacement()]),
      background: { ref: backgroundRef, x: 0, y: 0, width: 612, height: 792, opacity: 1 }
    },
    { imageDataUrls: new Map([['first', pngDataUrl(20, 10)]]) }
  )

  assert.deepEqual(
    warnings.map((warning) => warning.code),
    ['missing-background']
  )
})

test('layer filters exclude the hidden layer from warnings and drawn content', async () => {
  const withTextAndImage: KeptEntriesCanvasLayout = {
    ...layout([imagePlacement()]),
    placements: [
      {
        id: 'text-1',
        text: 'TextOnlyLayer',
        pageNumber: 1,
        x: 48,
        y: 300,
        width: 200,
        height: 20,
        rotation: 0,
        fontRef: { kind: 'standard-14', family: 'Helvetica' },
        fontSize: 11,
        color: '#17231c'
      }
    ]
  }
  const options = { imageDataUrls: new Map([['first', pngDataUrl(20, 10)]]) }

  const combined = decodeHexText(
    decodeContent(
      await exportProjectKeptEntriesCanvasPdf(project([entry('first')]), withTextAndImage, options)
    )
  )
  const imagesOnly = decodeHexText(
    decodeContent(
      await exportProjectKeptEntriesCanvasPdf(project([entry('first')]), withTextAndImage, {
        ...options,
        layers: { text: false }
      })
    )
  )

  assert.match(combined, /TextOnlyLayer/)
  assert.doesNotMatch(imagesOnly, /TextOnlyLayer/)

  const missingImageLayout = layout([
    imagePlacement({ source: { kind: 'uploaded-png', ref: 'missing' }, entryId: undefined })
  ])
  const bothLayers = getKeptEntriesCanvasWarnings(
    project([entry('first')]).entries,
    missingImageLayout,
    options
  )
  const textOnly = getKeptEntriesCanvasWarnings(
    project([entry('first')]).entries,
    missingImageLayout,
    { ...options, layers: { images: false } }
  )

  assert.deepEqual(
    bothLayers.map((warning) => warning.code),
    ['missing-image']
  )
  assert.deepEqual(
    textOnly.map((warning) => warning.code),
    ['empty-layout']
  )
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
