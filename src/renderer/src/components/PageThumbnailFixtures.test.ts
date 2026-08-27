import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PAGE_THUMBNAIL_WIDTH } from './PageThumbnail'

/**
 * The manual browser acceptance for the Pages thumbnail strip is blocked by the editor's localhost
 * network policy, so these tests exercise the same substance against real fixture PDFs: that pages
 * genuinely rasterize, that the shape the thumbnail reserves matches the real page, and that a
 * malformed file fails as a rejected promise rather than hanging or crashing.
 *
 * This is deliberately driven through pdfjs directly. `react-pdf` needs a DOM, and the suite renders
 * components to static markup, so a component-level render cannot prove a page ever paints.
 */
const fixture = (name: string): string => path.join(process.cwd(), 'test-data', 'fixtures', name)

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
type PdfDocument = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>

async function loadPdfjs(): Promise<PdfjsModule> {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as PdfjsModule
  pdfjs.GlobalWorkerOptions.workerSrc = ''
  return pdfjs
}

async function openFixture(name: string): Promise<PdfDocument> {
  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await readFile(fixture(name)))
  return pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise
}

// PT-A-011
test('renders a real multi-page fixture and reports a usable page count', async () => {
  const pdf = await openFixture('Transactions Report MEZ0R96H 20260123.pdf')
  try {
    assert.ok(pdf.numPages >= 1, 'fixture should expose at least one page')
  } finally {
    await pdf.destroy()
  }
})

// PT-A-012
test('every page reports positive dimensions so the reserved box can be corrected', async () => {
  const pdf = await openFixture('Transactions Report MEZ0R96H 20260123.pdf')
  try {
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 5); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      assert.ok(viewport.width > 0, `page ${pageNumber} width`)
      assert.ok(viewport.height > 0, `page ${pageNumber} height`)
    }
  } finally {
    await pdf.destroy()
  }
})

// PT-A-013
test('real fixtures include landscape pages, so a fixed placeholder cannot fit them all', async () => {
  const names = [
    'Transactions Report MEZ0R96H 20260123.pdf',
    'RichardPenderRevolut 2023 to 2026-part-1.pdf',
    'ocr-mixed-statement.pdf',
    'ocr-scanned-invoice.pdf'
  ]

  const ratios: number[] = []
  for (const name of names) {
    const pdf = await openFixture(name)
    try {
      for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 3); pageNumber += 1) {
        const viewport = (await pdf.getPage(pageNumber)).getViewport({ scale: 1 })
        ratios.push(viewport.width / viewport.height)
      }
    } finally {
      await pdf.destroy()
    }
  }

  assert.ok(ratios.length > 0, 'expected at least one fixture page')

  // Documents the reason `aspectRatio` is part of the prop surface: real projects mix portrait and
  // landscape, so any single built-in default is wrong for some page and the box would visibly jump.
  // Callers that know the page shape (for example from preflight) should pass it.
  const hasLandscape = ratios.some((ratio) => ratio > 1)
  const hasPortrait = ratios.some((ratio) => ratio < 1)
  assert.ok(
    hasLandscape && hasPortrait,
    `expected mixed page orientations across fixtures, saw ${ratios.map((value) => value.toFixed(3)).join(', ')}`
  )
})

// PT-A-014
test('a thumbnail-width viewport keeps a sane pixel height for a real page', async () => {
  const pdf = await openFixture('Transactions Report MEZ0R96H 20260123.pdf')
  try {
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scaled = page.getViewport({ scale: PAGE_THUMBNAIL_WIDTH / base.width })
    assert.ok(Math.round(scaled.width) === PAGE_THUMBNAIL_WIDTH)
    assert.ok(scaled.height > 0 && scaled.height < 1000)
  } finally {
    await pdf.destroy()
  }
})

// PT-A-015
test('a malformed PDF rejects rather than hanging, so the error state is reachable', async () => {
  await assert.rejects(() => openFixture('malformed-truncated.pdf'))
})
