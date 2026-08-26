import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractDocumentTextLayer,
  projectParserEntries,
  type ParserExtractionResult
} from '../extraction'
import type { ExtractionSettings } from '../shared/contracts'
import { runOcrOrchestration, type OcrOrchestrationProgress } from './ocrOrchestrator'

function parserResult(): ParserExtractionResult {
  return extractDocumentTextLayer(
    'document-1',
    [
      {
        documentId: 'document-1',
        pageNumber: 1,
        width: 200,
        height: 100,
        rotation: 0,
        items: [
          {
            str: 'Total amount due for consulting services',
            transform: [1, 0, 0, 10, 20, 60],
            width: 160,
            height: 20
          }
        ]
      },
      {
        documentId: 'document-1',
        pageNumber: 2,
        width: 200,
        height: 100,
        rotation: 0,
        imageObjectCount: 1,
        items: []
      }
    ],
    '2026-08-16T00:00:00.000Z'
  )
}

const balanced: ExtractionSettings = { mode: 'balanced', ocrLanguages: ['eng'] }

test('composes planning, rasterization, recognition, projection, and merge', async () => {
  const extraction = parserResult()
  const parserEntries = projectParserEntries(extraction, '2026-08-16T00:00:00.000Z')
  const progress: OcrOrchestrationProgress[] = []
  const canvas = {
    width: 400,
    height: 200,
    getContext: () => ({})
  } as unknown as HTMLCanvasElement
  const result = await runOcrOrchestration(
    {
      parserResult: extraction,
      parserEntries,
      pdf: {
        numPages: 2,
        getPage: async () => {
          throw new Error('injected rasterizer expected')
        }
      },
      settings: balanced,
      timestamp: '2026-08-16T00:00:00.000Z'
    },
    {
      onProgress: (value) => progress.push(value),
      dependencies: {
        rasterize: async (_documentId, _pdf, pages, options) => {
          assert.deepEqual(pages, [2])
          options?.onPageComplete?.(2, 1, 1)
          return [
            { documentId: 'document-1', pageNumber: 2, image: canvas, width: 400, height: 200 }
          ]
        },
        recognize: async (_pages, languages, options) => {
          assert.deepEqual([canvas.width, canvas.height], [400, 200])
          assert.deepEqual(languages, ['eng'])
          options?.onProgress?.({ pageNumber: 2, status: 'recognizing', progress: 0.5 })
          return [
            {
              id: 'w1',
              documentId: 'document-1',
              pageNumber: 2,
              text: 'Scanned row',
              confidence: 0.9,
              bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1, coordinateSpace: 'normalized' }
            }
          ]
        }
      }
    }
  )

  assert.deepEqual(result.plan.ocrPages, [2])
  assert.deepEqual(result.ocrBlocks[0]?.bbox, {
    x: 20,
    y: 70,
    width: 60,
    height: 10,
    coordinateSpace: 'pdf-points'
  })
  assert.equal(result.ocrEntries[0]?.source, 'ocr')
  assert.equal(result.entries.length, parserEntries.length + 1)
  assert.deepEqual([canvas.width, canvas.height], [0, 0])
  assert.deepEqual(
    progress.map((value) => value.stage),
    ['planning', 'rasterizing', 'recognizing', 'merging']
  )
})

test('skips rasterization and recognition when the plan selects no OCR pages', async () => {
  const extraction = parserResult()
  const settings: ExtractionSettings = { mode: 'custom', ocrLanguages: ['eng'], selectedPages: [] }
  let called = false
  const progress: OcrOrchestrationProgress[] = []
  const result = await runOcrOrchestration(
    {
      parserResult: extraction,
      parserEntries: projectParserEntries(extraction),
      pdf: {
        numPages: 2,
        getPage: async () => {
          throw new Error('unused')
        }
      },
      settings
    },
    {
      onProgress: (value) => progress.push(value),
      dependencies: {
        rasterize: async () => {
          called = true
          return []
        }
      }
    }
  )

  assert.equal(called, false)
  assert.equal(result.ocrEntries.length, 0)
  assert.deepEqual(
    progress.map((value) => value.stage),
    ['planning', 'merging']
  )
  assert.equal(progress.at(-1)?.progress, 1)
})

test('forwards cancellation to rasterization', async () => {
  const extraction = parserResult()
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    runOcrOrchestration(
      {
        parserResult: extraction,
        parserEntries: projectParserEntries(extraction),
        pdf: {
          numPages: 2,
          getPage: async () => {
            throw new Error('unused')
          }
        },
        settings: balanced
      },
      {
        signal: controller.signal,
        dependencies: {
          rasterize: async (_documentId, _pdf, _pages, options) => {
            if (options?.signal?.aborted) throw new DOMException('cancelled', 'AbortError')
            return []
          }
        }
      }
    ),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError'
  )
})

test('stops after rasterization when cancellation arrives before recognition', async () => {
  const extraction = parserResult()
  const controller = new AbortController()
  let recognized = false
  const canvas = {
    width: 100,
    height: 100,
    getContext: () => ({})
  } as unknown as HTMLCanvasElement

  await assert.rejects(
    runOcrOrchestration(
      {
        parserResult: extraction,
        parserEntries: projectParserEntries(extraction),
        pdf: {
          numPages: 2,
          getPage: async () => {
            throw new Error('unused')
          }
        },
        settings: balanced
      },
      {
        signal: controller.signal,
        dependencies: {
          rasterize: async (documentId, _pdf, pages) => {
            controller.abort()
            return pages.map((pageNumber) => ({
              documentId,
              pageNumber,
              image: canvas,
              width: 100,
              height: 100
            }))
          },
          recognize: async () => {
            recognized = true
            return []
          }
        }
      }
    ),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError'
  )
  assert.equal(recognized, false)
  assert.deepEqual([canvas.width, canvas.height], [0, 0])
})

test('releases rasterized canvas buffers when recognition fails', async () => {
  const extraction = parserResult()
  const canvas = {
    width: 100,
    height: 100,
    getContext: () => ({})
  } as unknown as HTMLCanvasElement

  await assert.rejects(
    runOcrOrchestration(
      {
        parserResult: extraction,
        parserEntries: projectParserEntries(extraction),
        pdf: {
          numPages: 2,
          getPage: async () => {
            throw new Error('unused')
          }
        },
        settings: balanced
      },
      {
        dependencies: {
          rasterize: async (documentId, _pdf, pages) =>
            pages.map((pageNumber) => ({
              documentId,
              pageNumber,
              image: canvas,
              width: 100,
              height: 100
            })),
          recognize: async () => {
            throw new Error('recognition failed')
          }
        }
      }
    ),
    /recognition failed/
  )
  assert.deepEqual([canvas.width, canvas.height], [0, 0])
})
