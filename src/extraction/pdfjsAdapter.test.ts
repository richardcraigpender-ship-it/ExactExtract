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
          return pageNumber === 1
            ? {
                fnArray: [2, 58, 91, 20, 85, 86],
                argsArray: [
                  [1],
                  [0.2, 0.4, 0.6],
                  [
                    [13, 14, 13, 14, 19],
                    [40, 700, 240, 700, 100, 100, 100, 300, 300, 200, 50, 40]
                  ],
                  [],
                  [],
                  []
                ]
              }
            : { fnArray: [83], argsArray: [[]] }
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
  assert.deepEqual(
    pages[0]?.visualRules?.map((rule) => [
      rule.orientation,
      rule.length,
      rule.thickness,
      rule.colour
    ]),
    [
      ['horizontal', 200, 1, '#336699'],
      ['vertical', 200, 1, '#336699'],
      ['horizontal', 50, 1, '#336699'],
      ['horizontal', 50, 1, '#336699'],
      ['vertical', 40, 1, '#336699'],
      ['vertical', 40, 1, '#336699']
    ]
  )
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
  assert.deepEqual(
    pages.map((page) => page.visualRules),
    [undefined, undefined]
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
