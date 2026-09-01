import assert from 'node:assert/strict'
import test from 'node:test'

import { detectDocumentStyleProfile } from './documentStyle'

interface MockTextItem {
  str: string
  transform: [number, number, number, number, number, number]
  fontName?: string
}

function installPdfMock(pages: Array<{ height: number; items: MockTextItem[] }>): void {
  ;(
    globalThis as typeof globalThis & {
      __PDFJS_GET_DOCUMENT__?: (source: { data: Uint8Array }) => { promise: Promise<unknown> }
    }
  ).__PDFJS_GET_DOCUMENT__ = () => ({
    promise: Promise.resolve({
      numPages: pages.length,
      destroy: async () => undefined,
      getPage: async (pageNumber: number) => {
        const page = pages[pageNumber - 1]
        if (!page) throw new Error('missing page')
        return {
          getViewport: () => ({ width: 612, height: page.height }),
          getTextContent: async () => ({ items: page.items })
        }
      }
    })
  })
}

test('detects compact text style clusters from digital PDF text items', async () => {
  installPdfMock([
    {
      height: 792,
      items: [
        {
          str: 'Statement Header',
          fontName: 'ABCDEE+Helvetica-Bold',
          transform: [18, 0, 0, 18, 48, 740]
        },
        { str: 'Payment row', fontName: 'Helvetica', transform: [11, 0, 0, 11, 48, 600] }
      ]
    },
    {
      height: 792,
      items: [
        { str: 'Second payment row', fontName: 'Helvetica', transform: [11, 0, 0, 11, 48, 590] }
      ]
    }
  ])

  const profile = await detectDocumentStyleProfile(
    'document-1',
    new Uint8Array([1, 2, 3]),
    '2026-09-01T12:00:00.000Z'
  )

  assert.equal(profile.documentId, 'document-1')
  assert.equal(profile.confidence, 'high')
  assert.equal(profile.source, 'pdf-text')
  assert.ok(profile.textStyles.some((style) => style.likelyRole === 'header'))
  assert.ok(profile.textStyles.some((style) => style.likelyRole === 'body'))
  assert.equal(profile.pageSummaries.length, 2)
})

test('reports an honest partial profile when no text style items are available', async () => {
  installPdfMock([{ height: 792, items: [] }])

  const profile = await detectDocumentStyleProfile('document-1', new Uint8Array([1]))

  assert.equal(profile.confidence, 'low')
  assert.equal(profile.source, 'ocr-image')
  assert.equal(profile.textStyles.length, 0)
  assert.equal(profile.warnings[0]?.code, 'image-only')
})
