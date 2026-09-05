import assert from 'node:assert/strict'
import zlib from 'node:zlib'
import test from 'node:test'
import { PDFDocument, StandardFonts } from 'pdf-lib'

import { PROJECT_SCHEMA_VERSION, type ProjectEntry, type ProjectState } from '../shared/contracts'
import {
  exportProjectCompactedSourceLayoutPdf,
  exportProjectKeptEntriesPdf,
  exportProjectKeptLayoutPdf,
  exportProjectPdf,
  exportProjectSourceLayoutPdf
} from './pdf'
import { exportProjectKeptEntriesCanvasPdf } from './keptEntriesCanvas'
import type { KeptEntriesCanvasLayout } from '../shared/keptEntriesLayout'

function entry(id: string, status: ProjectEntry['status'], text: string): ProjectEntry {
  return {
    id,
    rawText: text,
    normalizedText: text,
    source: 'parser',
    status,
    confidence: 0.83,
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 2,
        bbox: { x: 40, y: 600, width: 200, height: 20, coordinateSpace: 'pdf-points' }
      }
    ],
    tags: ['résumé'],
    createdAt: '2026-08-16T10:00:00.000Z',
    updatedAt: '2026-08-16T11:00:00.000Z'
  }
}

function project(entries: ProjectEntry[]): ProjectState {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: 'project-1',
    name: 'München Review',
    createdAt: '2026-08-16T09:00:00.000Z',
    updatedAt: '2026-08-16T12:00:00.000Z',
    documents: [
      {
        id: 'document-1',
        path: 'private.pdf',
        name: 'Résumé source.pdf',
        size: 100,
        pageCount: 2,
        importedAt: '2026-08-16T09:00:00.000Z'
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

function decodePdfText(pdfBytes: Uint8Array): string {
  const raw = Buffer.from(pdfBytes)
  const streamBlocks = [...raw.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]

  if (streamBlocks.length === 0) return raw.toString('latin1')

  return streamBlocks
    .map((match) => {
      const streamData = Buffer.from(match[1], 'latin1')
      try {
        return zlib.inflateSync(streamData).toString('latin1')
      } catch {
        return match[1]
      }
    })
    .join('\n')
}

test('generates a reopenable traceable PDF with metrics and Unicode text', async () => {
  const bytes = await exportProjectPdf(
    project([entry('kept', 'keep', 'Café total 120'), entry('maybe', 'maybe', 'Needs review')]),
    { metrics: [{ label: 'sum', value: 120, contributorCount: 1 }] }
  )
  const reopened = await PDFDocument.load(bytes)

  assert.ok(bytes.length > 1000)
  assert.ok(reopened.getPageCount() >= 1)
  assert.equal(reopened.getTitle(), 'München Review')
})

test('paginates long reviewed content and supports empty sections', async () => {
  const longText = Array.from(
    { length: 180 },
    (_, index) => `Line ${index + 1} source detail`
  ).join(' ')
  const longPdf = await PDFDocument.load(
    await exportProjectPdf(project([entry('long', 'keep', longText)]))
  )
  const emptyPdf = await PDFDocument.load(await exportProjectPdf(project([])))

  assert.ok(longPdf.getPageCount() > 1)
  assert.ok(emptyPdf.getPageCount() >= 1)
})

test('exports the persisted kept-entries canvas layout as a reopenable PDF', async () => {
  const layout: KeptEntriesCanvasLayout = {
    version: 1,
    pageSize: 'a4',
    orientation: 'landscape',
    placements: [
      {
        id: 'placement-1',
        text: 'Canvas total',
        x: 48,
        y: 48,
        width: 240,
        height: 24,
        rotation: 0,
        fontRef: { kind: 'standard-14', family: 'Helvetica' },
        fontSize: 14,
        color: '#17231c'
      }
    ]
  }
  const output = await PDFDocument.load(
    await exportProjectKeptEntriesCanvasPdf(project([entry('kept', 'keep', 'Total 120')]), layout)
  )

  assert.equal(output.getPageCount(), 1)
  assert.deepEqual(output.getPage(0).getSize(), { width: 841.89, height: 595.28 })
  assert.match(output.getTitle() ?? '', /Kept Entries Layout/)
})

test('preserves source pages without overlaying review regions at source coordinates', async () => {
  const source = await PDFDocument.create()
  source.addPage([400, 500])
  const sourceBytes = await source.save()
  const sourceProject = project([entry('kept', 'keep', 'Positioned row')])
  sourceProject.documents[0]!.pageCount = 1
  sourceProject.entries[0]!.regions[0]!.pageNumber = 1

  const outputBytes = await exportProjectSourceLayoutPdf(
    sourceProject,
    new Map([[sourceProject.documents[0]!.path, sourceBytes]])
  )
  const output = await PDFDocument.load(outputBytes)
  const pdfText = decodePdfText(outputBytes)

  assert.equal(output.getPageCount(), 1)
  assert.deepEqual(output.getPage(0).getSize(), { width: 400, height: 500 })
  assert.match(output.getTitle() ?? '', /München Review/)
  assert.doesNotMatch(pdfText, /0\.15\s+0\.55\s+0\.32|0\.8\s+0\.2\s+0\.16|0\.85\s+0\.58\s+0\.08/)
})

test('copies author, keywords, and creation date from the source PDF', async () => {
  const source = await PDFDocument.create()
  source.addPage([400, 500])
  source.setAuthor('Acme Bank plc')
  source.setKeywords(['statement, 2026, checking'])
  const creationDate = new Date('2026-01-05T00:00:00.000Z')
  source.setCreationDate(creationDate)
  const sourceBytes = await source.save()
  const sourceProject = project([entry('kept', 'keep', 'Positioned row')])
  sourceProject.documents[0]!.pageCount = 1
  sourceProject.entries[0]!.regions[0]!.pageNumber = 1

  const outputBytes = await exportProjectSourceLayoutPdf(
    sourceProject,
    new Map([[sourceProject.documents[0]!.path, sourceBytes]])
  )
  const output = await PDFDocument.load(outputBytes, { updateMetadata: false })

  assert.equal(output.getAuthor(), 'Acme Bank plc')
  assert.equal(output.getKeywords(), 'statement, 2026, checking')
  assert.equal(output.getCreationDate()?.toISOString(), creationDate.toISOString())
  // Title/Producer/Creator stay this app's own values so exports remain identifiable.
  assert.match(output.getTitle() ?? '', /München Review/)
  assert.equal(output.getProducer(), 'EXACT EXTRACT')
})

test('leaves metadata untouched when the source PDF has none', async () => {
  const source = await PDFDocument.create()
  source.addPage([400, 500])
  const sourceBytes = await source.save()
  const sourceProject = project([entry('kept', 'keep', 'Positioned row')])
  sourceProject.documents[0]!.pageCount = 1
  sourceProject.entries[0]!.regions[0]!.pageNumber = 1

  const outputBytes = await exportProjectSourceLayoutPdf(
    sourceProject,
    new Map([[sourceProject.documents[0]!.path, sourceBytes]])
  )
  const output = await PDFDocument.load(outputBytes)

  assert.equal(output.getAuthor(), undefined)
  assert.equal(output.getKeywords(), undefined)
})

test('copies source metadata through the lazily loaded kept-entries export', async () => {
  const source = await PDFDocument.create()
  const sourceFont = await source.embedFont(StandardFonts.Helvetica)
  const sourcePage = source.addPage([400, 500])
  sourcePage.drawText('Positioned row', { x: 40, y: 595, size: 10, font: sourceFont })
  source.setAuthor('Northgate Retail')
  const sourceBytes = await source.save()
  const sourceProject = project([entry('kept', 'keep', 'Positioned row')])
  sourceProject.documents[0]!.pageCount = 1
  sourceProject.entries[0]!.regions[0] = {
    documentId: 'document-1',
    pageNumber: 1,
    bbox: { x: 40, y: 590, width: 200, height: 14, coordinateSpace: 'pdf-points' }
  }

  const outputBytes = await exportProjectKeptEntriesPdf(
    sourceProject,
    new Map([[sourceProject.documents[0]!.path, sourceBytes]])
  )
  const output = await PDFDocument.load(outputBytes, { updateMetadata: false })

  assert.equal(output.getAuthor(), 'Northgate Retail')
})

test('outlines maybe and excluded rows without masking text or touching kept rows', async () => {
  const source = await PDFDocument.create()
  source.addPage([400, 500])
  const sourceBytes = await source.save()
  const sourceProject = project([
    entry('kept', 'keep', 'Keep this row'),
    entry('maybe', 'maybe', 'Review this row'),
    entry('excluded', 'exclude', 'Exclude this row')
  ])
  sourceProject.documents[0]!.pageCount = 1
  sourceProject.entries.forEach((item, index) => {
    item.regions[0] = {
      ...item.regions[0]!,
      pageNumber: 1,
      bbox: { x: 40, y: 300 - index * 30, width: 200, height: 20, coordinateSpace: 'pdf-points' }
    }
  })

  const outputBytes = await exportProjectSourceLayoutPdf(
    sourceProject,
    new Map([[sourceProject.documents[0]!.path, sourceBytes]])
  )
  const pdfText = decodePdfText(outputBytes)

  assert.match(pdfText, /0\.851\d* 0\.604\d* 0\.133\d* RG/, 'maybe rows get an amber outline')
  assert.match(pdfText, /0\.741\d* 0\.294\d* 0\.263\d* RG/, 'excluded rows get a red outline')
  assert.doesNotMatch(pdfText, /1 1 1 rg/, 'no row is masked with a white fill')
})

test('compacts source pages by removing excluded rows and retaining page structure', async () => {
  const source = await PDFDocument.create()
  source.addPage([400, 500])
  const sourceBytes = await source.save()
  const sourceProject = project([
    entry('excluded', 'exclude', 'Remove this row'),
    entry('kept', 'keep', 'Keep this row')
  ])
  sourceProject.documents[0]!.pageCount = 1
  sourceProject.entries.forEach((item, index) => {
    item.regions[0] = {
      ...item.regions[0]!,
      pageNumber: 1,
      bbox: {
        x: 40,
        y: index === 0 ? 420 : 390,
        width: 220,
        height: 12,
        coordinateSpace: 'pdf-points'
      }
    }
  })

  const outputBytes = await exportProjectCompactedSourceLayoutPdf(
    sourceProject,
    new Map([[sourceProject.documents[0]!.path, sourceBytes]])
  )
  const output = await PDFDocument.load(outputBytes)
  const pdfText = decodePdfText(outputBytes)

  // Verify the page structure is preserved from the source PDF
  assert.equal(output.getPageCount(), 1, 'Should have 1 page from source')
  assert.deepEqual(
    output.getPage(0).getSize(),
    { width: 400, height: 500 },
    'Should preserve page dimensions'
  )
  assert.match(output.getTitle() ?? '', /München Review/, 'Should preserve project title')
  assert.match(output.getSubject() ?? '', /Compacted/, 'Should indicate compacted layout')
  assert.match(pdfText, /4B656570207468697320726F77/, 'Should re-render the retained row')
  assert.doesNotMatch(pdfText, /52656D6F7665207468697320726F77/, 'Should omit the excluded row')
  assert.match(pdfText, /1 0 0 1 40 405\.36 Tm/, 'Should move the retained row into the gap')
})

test('does not truncate retained row text that exceeds its original source-row height', async () => {
  const source = await PDFDocument.create()
  source.addPage([400, 500])
  const sourceBytes = await source.save()
  const longText = Array.from({ length: 20 }, (_, index) => `word${index}`).join(' ')
  const sourceProject = project([entry('long', 'keep', longText)])
  sourceProject.documents[0]!.pageCount = 1
  sourceProject.entries[0]!.regions[0] = {
    documentId: 'document-1',
    pageNumber: 1,
    bbox: { x: 40, y: 400, width: 200, height: 12, coordinateSpace: 'pdf-points' }
  }

  const outputBytes = await exportProjectCompactedSourceLayoutPdf(
    sourceProject,
    new Map([[sourceProject.documents[0]!.path, sourceBytes]])
  )
  const pdfText = decodePdfText(outputBytes)

  for (const word of longText.split(' ')) {
    assert.match(
      pdfText,
      new RegExp(Buffer.from(word).toString('hex'), 'i'),
      `retained row text must not drop "${word}" when it exceeds the original row height`
    )
  }
})

test('reopens a multi-page compact export with retained traceable content and no orphans', async () => {
  const source = await PDFDocument.create()
  source.addPage([400, 500])
  source.addPage([400, 500])
  const sourceBytes = await source.save()
  const sourceProject = project([
    entry('excluded', 'exclude', 'Discarded source row'),
    entry('page-one', 'keep', 'Retained page one'),
    entry('page-two', 'keep', 'Retained page two')
  ])
  sourceProject.entries[0]!.regions[0] = {
    documentId: 'document-1',
    pageNumber: 1,
    bbox: { x: 40, y: 420, width: 220, height: 12, coordinateSpace: 'pdf-points' }
  }
  sourceProject.entries[1]!.regions[0] = {
    documentId: 'document-1',
    pageNumber: 1,
    bbox: { x: 40, y: 390, width: 220, height: 12, coordinateSpace: 'pdf-points' }
  }
  sourceProject.entries[2]!.regions[0] = {
    documentId: 'document-1',
    pageNumber: 2,
    bbox: { x: 40, y: 480, width: 220, height: 12, coordinateSpace: 'pdf-points' }
  }

  const outputBytes = await exportProjectCompactedSourceLayoutPdf(
    sourceProject,
    new Map([[sourceProject.documents[0]!.path, sourceBytes]])
  )
  const reopened = await PDFDocument.load(outputBytes)
  const pdfText = decodePdfText(outputBytes)

  assert.equal(reopened.getPageCount(), 2)
  assert.deepEqual(
    reopened.getPages().map((page) => page.getSize()),
    [
      { width: 400, height: 500 },
      { width: 400, height: 500 }
    ]
  )
  assert.match(pdfText, new RegExp(Buffer.from('Retained page one').toString('hex'), 'i'))
  assert.match(pdfText, new RegExp(Buffer.from('Retained page two').toString('hex'), 'i'))
  assert.doesNotMatch(pdfText, new RegExp(Buffer.from('Discarded source row').toString('hex'), 'i'))
})

test('exports kept entries in date order, reproducing the source page glyphs', async () => {
  const source = await PDFDocument.create()
  const sourceFont = await source.embedFont(StandardFonts.Helvetica)
  const sourcePage = source.addPage([400, 500])
  sourcePage.drawText('Alpha row text', { x: 40, y: 400, size: 10, font: sourceFont })
  sourcePage.drawText('Beta row text', { x: 40, y: 300, size: 10, font: sourceFont })
  const sourceBytes = await source.save()

  const sourceProject = project([
    { ...entry('beta', 'keep', 'Beta row text'), createdAt: '2026-08-16T12:00:00.000Z' },
    { ...entry('alpha', 'keep', 'Alpha row text'), createdAt: '2026-08-16T09:00:00.000Z' },
    entry('excluded', 'exclude', 'Should be omitted')
  ])
  sourceProject.documents[0]!.pageCount = 1
  sourceProject.entries[0]!.regions[0] = {
    documentId: 'document-1',
    pageNumber: 1,
    bbox: { x: 40, y: 395, width: 200, height: 14, coordinateSpace: 'pdf-points' }
  }
  sourceProject.entries[1]!.regions[0] = {
    documentId: 'document-1',
    pageNumber: 1,
    bbox: { x: 40, y: 295, width: 200, height: 14, coordinateSpace: 'pdf-points' }
  }

  const outputBytes = await exportProjectKeptEntriesPdf(
    sourceProject,
    new Map([[sourceProject.documents[0]!.path, sourceBytes]])
  )
  const reopened = await PDFDocument.load(outputBytes)
  const pdfText = decodePdfText(outputBytes)
  const alphaHex = Buffer.from('Alpha row text').toString('hex')
  const betaHex = Buffer.from('Beta row text').toString('hex')

  assert.ok(reopened.getPageCount() >= 1)
  assert.match(pdfText, new RegExp(alphaHex, 'i'), 'reuses the source glyphs for the earlier entry')
  assert.match(pdfText, new RegExp(betaHex, 'i'), 'reuses the source glyphs for the later entry')
  assert.doesNotMatch(
    pdfText,
    new RegExp(Buffer.from('Should be omitted').toString('hex'), 'i'),
    'excludes non-kept entries'
  )
  assert.ok(
    pdfText.toLowerCase().indexOf(alphaHex) < pdfText.toLowerCase().indexOf(betaHex),
    'renders the earlier createdAt entry before the later one'
  )
  assert.match(
    pdfText,
    new RegExp(Buffer.from('Plain text & styling summary').toString('hex'), 'i'),
    'includes a plain-text and styling summary section'
  )
  assert.match(
    pdfText,
    new RegExp(Buffer.from('x=40.0pt').toString('hex'), 'i'),
    'reports the source region x position for the summary line'
  )
  assert.match(
    pdfText,
    new RegExp(Buffer.from('y=395.0pt').toString('hex'), 'i'),
    'reports the source region y position for the summary line'
  )
  assert.match(
    pdfText,
    new RegExp(Buffer.from('w=200.0pt').toString('hex'), 'i'),
    'reports the source region width for the summary line'
  )
  assert.match(
    pdfText,
    new RegExp(Buffer.from('h=14.0pt').toString('hex'), 'i'),
    'reports the source region height for the summary line'
  )
  assert.match(
    pdfText,
    new RegExp(Buffer.from('scale=100%').toString('hex'), 'i'),
    'reports the drawn scale for the summary line'
  )
})

test('falls back to plain text for kept entries without a usable source region', async () => {
  const sourceProject = project([entry('kept', 'keep', 'No bounding box available')])
  sourceProject.entries[0]!.regions[0] = {
    documentId: 'document-1',
    pageNumber: 2
  }

  const outputBytes = await exportProjectKeptEntriesPdf(sourceProject, new Map())
  const pdfText = decodePdfText(outputBytes)

  assert.match(pdfText, new RegExp(Buffer.from('No bounding box available').toString('hex'), 'i'))
  assert.match(
    pdfText,
    new RegExp(Buffer.from('Position: unavailable').toString('hex'), 'i'),
    'notes when no source region is available for the styling summary'
  )
})

test('keeps source row glyphs while removing other rows and compacting', async () => {
  const source = await PDFDocument.create()
  const sourceFont = await source.embedFont(StandardFonts.Helvetica)
  const sourcePage = source.addPage([400, 500])
  sourcePage.drawText('Excluded row', { x: 40, y: 422, size: 9, font: sourceFont })
  sourcePage.drawText('Maybe row', { x: 40, y: 407, size: 9, font: sourceFont })
  sourcePage.drawText('Kept row', { x: 40, y: 392, size: 9, font: sourceFont })
  const sourceBytes = await source.save()
  const sourceProject = project([
    entry('excluded', 'exclude', 'Excluded row'),
    entry('maybe', 'maybe', 'Maybe row'),
    entry('kept', 'keep', 'Kept row')
  ])
  sourceProject.documents[0]!.pageCount = 1
  sourceProject.entries[0]!.regions[0] = {
    documentId: 'document-1',
    pageNumber: 1,
    bbox: { x: 40, y: 420, width: 220, height: 12, coordinateSpace: 'pdf-points' }
  }
  sourceProject.entries[1]!.regions[0] = {
    documentId: 'document-1',
    pageNumber: 1,
    bbox: { x: 40, y: 405, width: 220, height: 12, coordinateSpace: 'pdf-points' }
  }
  sourceProject.entries[2]!.regions[0] = {
    documentId: 'document-1',
    pageNumber: 1,
    bbox: { x: 40, y: 390, width: 220, height: 12, coordinateSpace: 'pdf-points' }
  }

  const outputBytes = await exportProjectKeptLayoutPdf(
    sourceProject,
    new Map([[sourceProject.documents[0]!.path, sourceBytes]])
  )
  const reopened = await PDFDocument.load(outputBytes)
  const pdfText = decodePdfText(outputBytes)

  assert.equal(reopened.getPageCount(), 2, 'one compacted source page plus one summary page')
  assert.match(pdfText, new RegExp(Buffer.from('Kept row').toString('hex'), 'i'))
  assert.doesNotMatch(
    pdfText,
    /1 0 0 1 40 417\.36 Tm/,
    'does not redraw replacement text at the compacted position'
  )
  assert.match(pdfText, /\/EmbeddedPdfPage-\d+ Do/, 'places a clipped source row on the page')
  assert.match(
    pdfText,
    new RegExp(Buffer.from('Kept entries (date order) & styling summary').toString('hex'), 'i'),
    'appends a single trailing summary section'
  )
  assert.match(
    pdfText,
    new RegExp(Buffer.from('font=source-preserved').toString('hex'), 'i'),
    'reports that the source glyphs were preserved'
  )
})
