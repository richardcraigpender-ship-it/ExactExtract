import { pdfjs } from 'react-pdf'
import type { DocumentStyleProfile, TextStyleCluster } from '../../../shared/documentStyle'
import { withPdfDocument, type DestroyablePdfDocument } from './pdfResourceLifecycle'
import { normalizePdfFontName } from '../../../style/fonts'

interface PdfDocumentLoadOverride {
  __PDFJS_GET_DOCUMENT__?: (source: { data: Uint8Array }) => { promise: Promise<StylePdfDocument> }
}

interface StylePdfDocument extends DestroyablePdfDocument {
  numPages: number
  getPage(pageNumber: number): Promise<{
    getViewport(options: { scale: number; rotation?: number }): { width: number; height: number }
    getTextContent(): Promise<{ items: readonly unknown[] }>
    commonObjs?: { get(name: string): unknown }
  }>
}

interface PdfTextItemLike {
  str: string
  transform: readonly number[]
  fontName?: string
}

interface PdfFontMetadata {
  name?: string
  loadedName?: string
  postscriptName?: string
  fontFamily?: string
  fontStyle?: string
  italic?: boolean
  bold?: boolean
  fontWeight?: number | string
  isEmbedded?: boolean
}

function isTextItem(value: unknown): value is PdfTextItemLike {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.str === 'string' &&
    Array.isArray(item.transform) &&
    item.transform.length >= 6 &&
    item.transform.every((part) => typeof part === 'number')
  )
}

function readFontMetadata(
  page: { commonObjs?: { get(name: string): unknown } },
  fontName?: string
): PdfFontMetadata {
  if (!fontName) return {}
  let value: unknown
  try {
    value = page.commonObjs?.get(fontName)
  } catch {
    // PDF.js may not have resolved the font object; the raw text-item name remains usable.
    return {}
  }
  if (typeof value !== 'object' || value === null) return {}
  const metadata = value as Record<string, unknown>
  return {
    ...(typeof metadata.name === 'string' ? { name: metadata.name } : {}),
    ...(typeof metadata.loadedName === 'string' ? { loadedName: metadata.loadedName } : {}),
    ...(typeof metadata.postscriptName === 'string'
      ? { postscriptName: metadata.postscriptName }
      : {}),
    ...(typeof metadata.fontFamily === 'string' ? { fontFamily: metadata.fontFamily } : {}),
    ...(typeof metadata.fontStyle === 'string' ? { fontStyle: metadata.fontStyle } : {}),
    ...(typeof metadata.italic === 'boolean' ? { italic: metadata.italic } : {}),
    ...(typeof metadata.bold === 'boolean' ? { bold: metadata.bold } : {}),
    ...(typeof metadata.fontWeight === 'number' || typeof metadata.fontWeight === 'string'
      ? { fontWeight: metadata.fontWeight }
      : {}),
    ...(typeof metadata.isEmbedded === 'boolean' ? { isEmbedded: metadata.isEmbedded } : {})
  }
}

function fontSize(transform: readonly number[]): number {
  const [, b = 0, c = 0, d = 0] = transform
  return Math.max(1, Math.round(Math.hypot(b, d) || Math.abs(d) || Math.abs(c)))
}

function roleFor(
  size: number,
  y: number,
  pageHeight: number,
  largestSize: number
): TextStyleCluster['likelyRole'] {
  if (y > pageHeight * 0.88) return 'header'
  if (y < pageHeight * 0.12) return 'footer'
  if (size >= largestSize + 2) return 'header'
  if (size <= 8) return 'small-print'
  return 'body'
}

function sampleText(samples: string[], value: string): string[] {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length < 2 || samples.includes(normalized)) return samples
  return [...samples, normalized].slice(0, 3)
}

export async function detectDocumentStyleProfile(
  documentId: string,
  data: Uint8Array,
  generatedAt: string = new Date().toISOString()
): Promise<DocumentStyleProfile> {
  return withPdfDocument(
    async () => {
      const override = (globalThis as typeof globalThis & PdfDocumentLoadOverride)
        .__PDFJS_GET_DOCUMENT__
      const pdf = override
        ? await override({ data: data.slice() }).promise
        : await pdfjs.getDocument({ data: data.slice() }).promise
      return pdf as StylePdfDocument
    },
    async (pdf) => {
      const observations: Array<{
        fontFamily: string
        embeddedFontName?: string
        postscriptName?: string
        fontStyle?: string
        embedded?: boolean
        size: number
        fontWeight: TextStyleCluster['fontWeight']
        italic: boolean
        likelyRole: TextStyleCluster['likelyRole']
        pageNumber: number
        text: string
      }> = []
      const warnings: DocumentStyleProfile['warnings'] = []
      const pageSummaries: DocumentStyleProfile['pageSummaries'] = []

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        try {
          const page = await pdf.getPage(pageNumber)
          const viewport = page.getViewport({ scale: 1, rotation: 0 })
          const content = await page.getTextContent()
          const items = (content.items as readonly unknown[]).filter(isTextItem)
          const largestSize = Math.max(0, ...items.map((item) => fontSize(item.transform)))
          let characterCount = 0
          for (const item of items) {
            const text = item.str.trim()
            if (!text) continue
            characterCount += text.length
            const size = fontSize(item.transform)
            const metadata = readFontMetadata(page, item.fontName)
            const normalizedFont = normalizePdfFontName(
              metadata.fontFamily ?? metadata.name ?? item.fontName
            )
            observations.push({
              fontFamily: normalizedFont.fontFamily,
              ...(metadata.name || metadata.loadedName
                ? { embeddedFontName: metadata.name ?? metadata.loadedName }
                : {}),
              ...(metadata.postscriptName ? { postscriptName: metadata.postscriptName } : {}),
              ...(metadata.fontStyle ? { fontStyle: metadata.fontStyle } : {}),
              ...(metadata.isEmbedded === undefined ? {} : { embedded: metadata.isEmbedded }),
              size,
              fontWeight:
                typeof metadata.fontWeight === 'number'
                  ? metadata.fontWeight >= 700
                    ? 'bold'
                    : metadata.fontWeight >= 600
                      ? 'semibold'
                      : metadata.fontWeight >= 500
                        ? 'medium'
                        : 'regular'
                  : metadata.bold
                    ? 'bold'
                    : metadata.italic
                      ? normalizedFont.fontWeight
                      : normalizedFont.fontWeight,
              italic: metadata.italic ?? normalizedFont.italic,
              likelyRole: roleFor(size, item.transform[5] ?? 0, viewport.height, largestSize),
              pageNumber,
              text
            })
          }
          pageSummaries.push({
            pageNumber,
            textStyleClusterIds: [],
            imageObjectCount: 0,
            characterCount
          })
        } catch {
          warnings.push({
            code: 'partial-profile',
            pageNumber,
            message: `Page ${pageNumber} style metadata could not be read.`
          })
        }
      }

      const clusters = new Map<string, TextStyleCluster & { pages: Set<number> }>()
      for (const observation of observations) {
        const key = [
          observation.fontFamily,
          observation.embeddedFontName ?? '',
          observation.postscriptName ?? '',
          observation.fontStyle ?? '',
          observation.size,
          observation.fontWeight,
          observation.italic,
          observation.likelyRole
        ].join(':')
        const current = clusters.get(key)
        if (current) {
          current.occurrenceCount += 1
          current.characterCount += observation.text.length
          current.pages.add(observation.pageNumber)
          current.sampleText = sampleText(current.sampleText, observation.text)
        } else {
          clusters.set(key, {
            id: `text-${clusters.size + 1}`,
            fontFamily: observation.fontFamily,
            ...(observation.embeddedFontName
              ? { embeddedFontName: observation.embeddedFontName }
              : {}),
            ...(observation.postscriptName ? { postscriptName: observation.postscriptName } : {}),
            ...(observation.fontStyle ? { fontStyle: observation.fontStyle } : {}),
            ...(observation.embedded === undefined ? {} : { embedded: observation.embedded }),
            fontSize: observation.size,
            fontWeight: observation.fontWeight,
            italic: observation.italic,
            underline: false,
            role: observation.likelyRole,
            likelyRole: observation.likelyRole,
            occurrenceCount: 1,
            characterCount: observation.text.length,
            pageNumbers: [observation.pageNumber],
            pages: new Set([observation.pageNumber]),
            sampleText: sampleText([], observation.text),
            colour: { hex: '#17231c', name: 'Text' }
          })
        }
      }

      const textStyles = [...clusters.values()]
        .map(({ pages, ...cluster }) => ({
          ...cluster,
          pageNumbers: [...pages].sort((left, right) => left - right)
        }))
        .sort(
          (left, right) =>
            right.occurrenceCount - left.occurrenceCount ||
            right.fontSize - left.fontSize ||
            left.likelyRole.localeCompare(right.likelyRole) ||
            left.id.localeCompare(right.id)
        )
        .slice(0, 12)

      const clusterIdsByPage = new Map<number, Set<string>>()
      for (const style of textStyles) {
        for (const pageNumber of style.pageNumbers) {
          const ids = clusterIdsByPage.get(pageNumber) ?? new Set<string>()
          ids.add(style.id)
          clusterIdsByPage.set(pageNumber, ids)
        }
      }

      if (observations.length === 0) {
        warnings.push({
          code: 'image-only',
          message:
            'No embedded text style metadata was found; scanned/image-only style detection is partial.'
        })
      }

      return {
        id: `${documentId}:style:${generatedAt}`,
        documentId,
        generatedAt,
        detectorVersion: 1,
        source: observations.length > 0 ? 'pdf-text' : 'ocr-image',
        confidence: observations.length > 0 ? 'high' : 'low',
        textStyles,
        dividerStyles: [],
        colourPalette:
          textStyles.length > 0
            ? [
                {
                  hex: '#17231c',
                  name: 'Text',
                  occurrenceCount: observations.length,
                  likelyRole: 'text' as const
                }
              ]
            : [],
        pageSummaries: pageSummaries.map((page) => ({
          ...page,
          textStyleClusterIds: [...(clusterIdsByPage.get(page.pageNumber) ?? [])],
          dominantTextStyleId: [...(clusterIdsByPage.get(page.pageNumber) ?? [])][0]
        })),
        warnings
      }
    }
  )
}
