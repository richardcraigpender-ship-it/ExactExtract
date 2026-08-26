import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createWorker } from 'tesseract.js'

import { extractPdfJsDocument, projectParserEntries } from '../src/extraction/index'
import {
  rasterizePdfPages,
  recognizeTesseractPages,
  runOcrOrchestration,
  type PdfJsRasterDocumentLike
} from '../src/ocr/index'
import type { ExtractionSettings } from '../src/shared/contracts'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const fixtureRoot = join(projectRoot, 'test-data', 'fixtures')
const languageDataPath = join(projectRoot, 'src', 'renderer', 'public', 'ocr', 'tessdata')
const standardFontDataUrl = `${join(
  projectRoot,
  'node_modules',
  'pdfjs-dist',
  'standard_fonts'
).replaceAll('\\', '/')}/`
const settings: ExtractionSettings = { mode: 'balanced', ocrLanguages: ['eng'] }
const cases = [
  { id: 'scanned-invoice', fileName: 'ocr-scanned-invoice.pdf', kind: 'image' },
  { id: 'mixed-statement', fileName: 'ocr-mixed-statement.pdf', kind: 'mixed' },
  { id: 'rotated-form', fileName: 'ocr-rotated-form.pdf', kind: 'rotated' }
] as const

async function main(): Promise<void> {
  for (const fixture of cases) {
    const bytes = new Uint8Array(await readFile(join(fixtureRoot, fixture.fileName)))
    const pdf = await getDocument({ data: bytes, disableWorker: true, standardFontDataUrl }).promise
    try {
      const extraction = await extractPdfJsDocument(fixture.id, pdf, '2026-08-23T00:00:00.000Z')
      const page = extraction.pages[0]
      if (page?.kind !== fixture.kind || !page.ocrRecommended) {
        throw new Error(
          `${fixture.fileName} classified as ${page?.kind ?? '<missing>'} with OCR recommended ${page?.ocrRecommended ?? false}.`
        )
      }

      const parserEntries = projectParserEntries(extraction, '2026-08-23T00:00:00.000Z')
      const result = await runOcrOrchestration(
        {
          parserResult: extraction,
          parserEntries,
          pdf: pdf as unknown as PdfJsRasterDocumentLike,
          settings,
          timestamp: '2026-08-23T00:00:00.000Z'
        },
        {
          dependencies: {
            rasterize: async (documentId, document, pageNumbers, options) => {
              const pages = await rasterizePdfPages(documentId, document, pageNumbers, {
                ...options,
                createCanvas: (width, height) =>
                  createCanvas(width, height) as unknown as HTMLCanvasElement
              })
              return pages.map((page) => ({
                ...page,
                image: (page.image as unknown as ReturnType<typeof createCanvas>).toBuffer(
                  'image/png'
                )
              }))
            },
            recognize: (pages, languages, options) =>
              recognizeTesseractPages(pages, languages, {
                ...options,
                createWorker: (workerLanguages, onProgress) =>
                  createWorker(workerLanguages, undefined, {
                    langPath: languageDataPath,
                    cacheMethod: 'none',
                    logger: onProgress
                  })
              })
          }
        }
      )

      if (result.plan.ocrPages.join(',') !== '1') {
        throw new Error(`${fixture.fileName} did not plan page 1 for OCR.`)
      }
      if (result.ocrEntries.length === 0) {
        throw new Error(`${fixture.fileName} produced no OCR entries.`)
      }
      if (
        result.ocrEntries.some(
          (entry) =>
            entry.source !== 'ocr' ||
            entry.regions.length === 0 ||
            entry.regions.some(
              (region) => !region.bbox || region.bbox.coordinateSpace !== 'pdf-points'
            )
        )
      ) {
        throw new Error(`${fixture.fileName} produced an untraceable OCR entry.`)
      }
      if (result.entries.length < result.ocrEntries.length) {
        throw new Error(`${fixture.fileName} lost OCR entries during parser/OCR merge.`)
      }

      console.log(
        `${fixture.fileName}: ${page.kind}, ${parserEntries.length} parser entries, ${result.ocrEntries.length} traceable OCR entries.`
      )
    } finally {
      await pdf.destroy()
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
