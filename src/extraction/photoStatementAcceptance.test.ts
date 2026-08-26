import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createWorker } from 'tesseract.js'

import { mapFinancialEntry } from '../analysis/reconcile'
import { extractPdfJsDocument, projectParserEntries } from './index'
import {
  rasterizePdfPages,
  recognizeTesseractPages,
  runOcrOrchestration,
  type PdfJsRasterDocumentLike
} from '../ocr'

const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const fixtureRoot = join(projectRoot, 'test-data', 'fixtures')
const languageDataPath = join(projectRoot, 'src', 'renderer', 'public', 'ocr', 'tessdata')
const standardFontDataUrl = `${join(
  projectRoot,
  'node_modules',
  'pdfjs-dist',
  'standard_fonts'
).replaceAll('\\', '/')}/`

for (const fixtureName of ['20260816_223738.pdf', 'bank-statement-blog-image.pdf']) {
  test(`${fixtureName} remains traceable without fabricating financial rows`, async () => {
    const bytes = new Uint8Array(await readFile(join(fixtureRoot, fixtureName)))
    const pdf = await getDocument({ data: bytes, disableWorker: true, standardFontDataUrl }).promise

    try {
      const extraction = await extractPdfJsDocument(
        'photo-statement',
        pdf,
        '2026-08-24T00:00:00.000Z'
      )
      const parserEntries = projectParserEntries(extraction, '2026-08-24T00:00:00.000Z')
      const result = await runOcrOrchestration(
        {
          parserResult: extraction,
          parserEntries,
          pdf: pdf as unknown as PdfJsRasterDocumentLike,
          settings: { mode: 'balanced', ocrLanguages: ['eng'] },
          timestamp: '2026-08-24T00:00:00.000Z'
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

      const financialRows = result.entries
        .map((entry) =>
          mapFinancialEntry(entry, {
            amountColumns: ['money-out', 'money-in', 'balance'],
            dateSource: 'detected-date',
            descriptionSource: 'detected-description',
            referenceSource: 'ignore',
            categorySource: 'ignore'
          })
        )
        .filter(Boolean)

      assert.equal(extraction.pages[0]?.kind, 'image')
      assert.deepEqual(result.plan.ocrPages, [1])
      assert.ok(result.ocrEntries.length > 0)
      assert.ok(
        result.ocrEntries.every((entry) =>
          entry.regions.every((region) => region.bbox?.coordinateSpace === 'pdf-points')
        )
      )
      assert.equal(financialRows.length, 0)
    } finally {
      await pdf.destroy()
    }
  })
}
