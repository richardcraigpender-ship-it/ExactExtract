import assert from 'node:assert/strict'
import test from 'node:test'

import { extractPdfJsDocument, readPdfJsTextLayer, type PdfJsDocumentLike } from './pdfjsAdapter'

function fakeDocument(): PdfJsDocumentLike {
  return {
    numPages: 2,
    async getPage(pageNumber) {
      return {
        rotate: pageNumber === 2 ? 450 : 0,
        getViewport: () => ({ width: 612, height: 792 }),
        async getTextContent() {
          return {
            items:
              pageNumber === 1
                ? [
                    {
                      str: 'Invoice',
                      transform: [1, 0, 0, 10, 40, 700],
                      width: 50,
                      height: 10,
                      fontName: 'statement-font'
                    },
                    {
                      str: 'Amount due for services 40',
                      transform: [1, 0, 0, 10, 40, 680],
                      width: 90,
                      height: 10
                    },
                    { str: 'ignored', transform: [1, 0], width: 10, height: 10 }
                  ]
                : [],
            styles: { 'statement-font': { ascent: 0.72 } }
          }
        },
        async getOperatorList() {
          return { fnArray: pageNumber === 1 ? [10, 85, 86, 20] : [83] }
        }
      }
    }
  }
}

test('adapts PDF.js-shaped pages and filters unsupported text items', async () => {
  const pages = await readPdfJsTextLayer('document-1', fakeDocument())

  assert.equal(pages.length, 2)
  assert.equal(pages[0]?.items.length, 2)
  assert.equal(pages[0]?.items[0]?.fontAscentRatio, 0.72)
  assert.equal(pages[0]?.items[1]?.fontAscentRatio, 0.8)
  assert.equal(pages[0]?.imageObjectCount, 2)
  assert.equal(pages[1]?.imageObjectCount, 1)
  assert.equal(pages[1]?.rotation, 90)
})

test('falls back to zero images when operator lists are unavailable', async () => {
  const pdf = fakeDocument()
  const originalGetPage = pdf.getPage
  pdf.getPage = async (pageNumber) => {
    const page = await originalGetPage(pageNumber)
    return {
      rotate: page.rotate,
      getViewport: page.getViewport,
      getTextContent: page.getTextContent
    }
  }

  const pages = await readPdfJsTextLayer('document-1', pdf)

  assert.deepEqual(
    pages.map((page) => page.imageObjectCount),
    [0, 0]
  )
})

test('runs the parser pipeline for a PDF.js-shaped document', async () => {
  const result = await extractPdfJsDocument(
    'document-1',
    fakeDocument(),
    '2026-08-15T15:00:00.000Z'
  )

  assert.equal(result.classification.kind, 'invoice')
  assert.equal(result.preflight.pages.length, 2)
  assert.equal(result.preflight.pages[0]?.kind, 'mixed')
  assert.equal(result.preflight.pages[1]?.kind, 'rotated')
})
