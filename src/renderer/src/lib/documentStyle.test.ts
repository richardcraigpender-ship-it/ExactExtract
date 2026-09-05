import assert from 'node:assert/strict'
import test from 'node:test'

import { detectDocumentStyleProfile } from './documentStyle'

interface MockTextItem {
  str: string
  transform: [number, number, number, number, number, number]
  fontName?: string
}

interface MockFontMetadata {
  name?: string
  postscriptName?: string
  fontStyle?: string
  italic?: boolean
  bold?: boolean
  isEmbedded?: boolean
}

function installPdfMock(
  pages: Array<{
    height: number
    items: MockTextItem[]
    fonts?: Record<string, MockFontMetadata>
  }>
): void {
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
          getTextContent: async () => ({ items: page.items }),
          commonObjs: {
            get: (fontName: string) => page.fonts?.[fontName]
          }
        }
      }
    })
  })
}

test('preserves embedded PDF.js font metadata in the style profile', async () => {
  installPdfMock([
    {
      height: 792,
      items: [
        {
          str: 'Embedded title',
          fontName: 'g_d0_f1',
          transform: [18, 0, 0, 18, 48, 740]
        }
      ],
      fonts: {
        g_d0_f1: {
          name: 'ABCDEE+AcmeSans-SemiboldItalic',
          postscriptName: 'AcmeSans-SemiboldItalic',
          fontStyle: 'Semibold Italic',
          italic: true,
          bold: true,
          isEmbedded: true
        }
      }
    }
  ])

  const profile = await detectDocumentStyleProfile('document-embedded', new Uint8Array([1]))
  const style = profile.textStyles[0]
  assert.equal(style?.embeddedFontName, 'ABCDEE+AcmeSans-SemiboldItalic')
  assert.equal(style?.postscriptName, 'AcmeSans-SemiboldItalic')
  assert.equal(style?.fontStyle, 'Semibold Italic')
  assert.equal(style?.embedded, true)
  assert.equal(style?.italic, true)
})

test('falls back to the text-item font when PDF.js metadata is unavailable', async () => {
  ;(
    globalThis as typeof globalThis & {
      __PDFJS_GET_DOCUMENT__?: (source: { data: Uint8Array }) => { promise: Promise<unknown> }
    }
  ).__PDFJS_GET_DOCUMENT__ = () => ({
    promise: Promise.resolve({
      numPages: 1,
      destroy: async () => undefined,
      getPage: async () => ({
        getViewport: () => ({ width: 612, height: 792 }),
        getTextContent: async () => ({
          items: [
            {
              str: 'Fallback text',
              fontName: 'ABCDEE+Helvetica-Bold',
              transform: [12, 0, 0, 12, 48, 740]
            }
          ]
        }),
        commonObjs: {
          get: () => {
            throw new Error('font object is unavailable')
          }
        }
      })
    })
  })

  const profile = await detectDocumentStyleProfile('document-font-fallback', new Uint8Array([1]))

  assert.equal(profile.textStyles.length, 1)
  assert.equal(profile.textStyles[0]?.fontFamily, 'Helvetica')
  assert.equal(profile.textStyles[0]?.fontWeight, 'bold')
  assert.equal(profile.warnings.length, 0)
})

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
