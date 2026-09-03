import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoggerMessage } from 'tesseract.js'

import {
  assertOfflineOcrLanguageAssets,
  getOfflineTesseractWorkerOptions,
  OcrProviderError,
  recognizeTesseractPages,
  type TesseractWorkerFactory
} from './tesseractProvider'
import { getOcrLanguageAssetUrl } from '../shared/ocrAssets'

test('configures worker, core, and trained data from bundled offline assets', () => {
  const options = getOfflineTesseractWorkerOptions()

  assert.equal(options?.workerPath, 'exact-extract-ocr://assets/worker.min.js')
  assert.equal(options?.corePath, 'exact-extract-ocr://assets/core')
  assert.equal(options?.langPath, 'exact-extract-ocr://assets/tessdata')
  assert.equal(options?.gzip, true)
  assert.equal(options?.cacheMethod, 'none')
  assert.equal(JSON.stringify(options).includes('https://'), false)
})

test('resolves every supported language to bundled compressed trained data', () => {
  assert.deepEqual(['eng', 'spa', 'fra', 'deu'].map(getOcrLanguageAssetUrl), [
    'exact-extract-ocr://assets/tessdata/eng.traineddata.gz',
    'exact-extract-ocr://assets/tessdata/spa.traineddata.gz',
    'exact-extract-ocr://assets/tessdata/fra.traineddata.gz',
    'exact-extract-ocr://assets/tessdata/deu.traineddata.gz'
  ])
})

test('checks local language availability and identifies the missing asset', async () => {
  const requestedUrls: string[] = []
  await assertOfflineOcrLanguageAssets(['eng', 'spa'], async (input) => {
    requestedUrls.push(String(input))
    return new Response(null, { status: 200 })
  })
  assert.deepEqual(requestedUrls, [
    'exact-extract-ocr://assets/tessdata/eng.traineddata.gz',
    'exact-extract-ocr://assets/tessdata/spa.traineddata.gz'
  ])

  await assert.rejects(
    assertOfflineOcrLanguageAssets(
      ['fra'],
      async () => new Response(null, { status: 404, statusText: 'Not Found' })
    ),
    (error: unknown) =>
      error instanceof OcrProviderError &&
      error.code === 'missing-language-data' &&
      error.message.includes('fra') &&
      error.message.includes('fra.traineddata.gz')
  )
})

function fakeFactory(events: string[]): TesseractWorkerFactory {
  return async (_languages, onProgress) => ({
    async recognize() {
      onProgress?.({ status: 'recognizing text', progress: 0.5 } as LoggerMessage)
      return {
        jobId: 'job-1',
        data: {
          blocks: [
            {
              paragraphs: [
                {
                  lines: [
                    {
                      words: [
                        { text: 'Total', confidence: 87, bbox: { x0: 20, y0: 40, x1: 80, y1: 60 } },
                        { text: '  ', confidence: 99, bbox: { x0: 90, y0: 40, x1: 100, y1: 60 } }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      } as never
    },
    async terminate() {
      events.push('terminated')
      return { jobId: 'terminate', data: null }
    }
  })
}

test('maps Tesseract words to normalized OCR blocks and terminates the worker', async () => {
  const events: string[] = []
  const progress: number[] = []
  const blocks = await recognizeTesseractPages(
    [{ documentId: 'document-1', pageNumber: 2, image: new Blob(), width: 200, height: 100 }],
    ['eng'],
    { createWorker: fakeFactory(events), onProgress: (value) => progress.push(value.progress) }
  )

  assert.equal(blocks.length, 1)
  assert.equal(blocks[0]?.id, 'w1')
  assert.equal(blocks[0]?.confidence, 0.87)
  assert.deepEqual(blocks[0]?.bbox, {
    x: 0.1,
    y: 0.4,
    width: 0.3,
    height: 0.2,
    coordinateSpace: 'normalized'
  })
  assert.deepEqual(progress, [0.5, 1])
  assert.deepEqual(events, ['terminated'])
})

test('rejects invalid languages before creating a worker', async () => {
  let created = false
  await assert.rejects(
    recognizeTesseractPages([], [], {
      createWorker: async () => {
        created = true
        throw new Error('should not run')
      }
    }),
    /language/
  )
  assert.equal(created, false)
})

test('reports unsupported languages and worker startup failures with actionable codes', async () => {
  const page = {
    documentId: 'document-1',
    pageNumber: 1,
    image: new Blob(),
    width: 100,
    height: 100
  }
  await assert.rejects(
    recognizeTesseractPages([page], ['xxx']),
    (error: unknown) => error instanceof OcrProviderError && error.code === 'unsupported-language'
  )
  await assert.rejects(
    recognizeTesseractPages([page], ['eng'], {
      createWorker: async () => {
        throw new Error('language download failed')
      }
    }),
    (error: unknown) => error instanceof OcrProviderError && error.code === 'worker-start-failed'
  )
})

test('reports recognition failures with the affected page and terminates', async () => {
  let terminated = false
  await assert.rejects(
    recognizeTesseractPages(
      [{ documentId: 'document-1', pageNumber: 3, image: new Blob(), width: 100, height: 100 }],
      ['eng'],
      {
        createWorker: async () => ({
          recognize: async () => {
            throw new Error('recognition crashed')
          },
          terminate: async () => {
            terminated = true
            return { jobId: 'terminate', data: null }
          }
        })
      }
    ),
    (error: unknown) =>
      error instanceof OcrProviderError &&
      error.code === 'recognition-failed' &&
      error.message.includes('page 3')
  )
  assert.equal(terminated, true)
})

test('honors cancellation and still terminates the worker', async () => {
  const events: string[] = []
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    recognizeTesseractPages(
      [{ documentId: 'document-1', pageNumber: 1, image: new Blob(), width: 100, height: 100 }],
      ['eng'],
      { createWorker: fakeFactory(events), signal: controller.signal }
    ),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError'
  )
  assert.deepEqual(events, ['terminated'])
})
