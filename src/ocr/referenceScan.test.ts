import assert from 'node:assert/strict'
import test from 'node:test'

import type { OcrRecognizedBlock } from '../extraction'
import {
  extractOcrReferenceCandidates,
  runOcrReferenceScan,
  type OcrReferenceRescanProgress
} from './referenceScan'
import type { OcrImagePage } from './tesseractProvider'

const pdf = {
  numPages: 3,
  getPage: async () => ({
    rotate: 0,
    getViewport: () => ({ width: 200, height: 100 }),
    render: () => ({ promise: Promise.resolve() })
  })
}

function canvas(): HTMLCanvasElement {
  return {
    width: 600,
    height: 300,
    getContext: () => ({})
  } as unknown as HTMLCanvasElement
}

test('scans selected pages and converts OCR reference candidates to PDF points', async () => {
  const progress: OcrReferenceRescanProgress[] = []
  const rasterCanvas = canvas()
  const result = await runOcrReferenceScan('document-1', pdf, {
    languages: ['eng'],
    pageNumbers: [2],
    onProgress: (value) => progress.push(value),
    dependencies: {
      rasterize: async (documentId, _pdf, pageNumbers, options) => {
        assert.equal(documentId, 'document-1')
        assert.deepEqual(pageNumbers, [2])
        assert.equal(options?.scale, 3)
        assert.equal(options?.maxPixels, 24_000_000)
        options?.onPageComplete?.(2, 1, 1)
        return [{ documentId, pageNumber: 2, image: rasterCanvas, width: 600, height: 300 }]
      },
      recognize: async (pages, languages, options) => {
        assert.deepEqual(languages, ['eng'])
        assert.deepEqual(
          pages.map((page) => page.pageNumber),
          [2]
        )
        options?.onProgress?.({ pageNumber: 2, status: 'recognizing', progress: 0.5 })
        return [
          {
            id: 'word-1',
            documentId: 'document-1',
            pageNumber: 2,
            text: 'Ref CARD-100',
            confidence: 0.91,
            bbox: { x: 0.1, y: 0.2, width: 0.25, height: 0.1, coordinateSpace: 'normalized' }
          },
          {
            id: 'word-2',
            documentId: 'document-1',
            pageNumber: 2,
            text: 'ordinary words',
            confidence: 0.99,
            bbox: { x: 0.1, y: 0.4, width: 0.25, height: 0.1, coordinateSpace: 'normalized' }
          }
        ] satisfies OcrRecognizedBlock[]
      }
    }
  })

  assert.equal(result.summary.scannedPageCount, 1)
  assert.equal(result.summary.candidateCount, 1)
  assert.deepEqual(result.candidates[0]?.references, ['CARD-100'])
  assert.deepEqual(result.candidates[0]?.bbox, {
    x: 20,
    y: 70,
    width: 50,
    height: 10,
    coordinateSpace: 'pdf-points'
  })
  assert.deepEqual([rasterCanvas.width, rasterCanvas.height], [0, 0])
  assert.deepEqual(
    progress.map((value) => value.stage),
    ['rasterizing', 'recognizing', 'filtering']
  )
})

test('releases rasterized canvases when cancellation arrives before recognition', async () => {
  const controller = new AbortController()
  const rasterCanvas = canvas()
  let recognized = false

  await assert.rejects(
    runOcrReferenceScan('document-1', pdf, {
      languages: ['eng'],
      pageNumbers: [1],
      signal: controller.signal,
      dependencies: {
        rasterize: async (): Promise<OcrImagePage[]> => {
          controller.abort()
          return [
            {
              documentId: 'document-1',
              pageNumber: 1,
              image: rasterCanvas,
              width: 600,
              height: 300
            }
          ]
        },
        recognize: async () => {
          recognized = true
          return []
        }
      }
    }),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError'
  )

  assert.equal(recognized, false)
  assert.deepEqual([rasterCanvas.width, rasterCanvas.height], [0, 0])
})

function block(id: string, text: string, confidence = 0.9): OcrRecognizedBlock {
  return {
    id,
    documentId: 'document-1',
    pageNumber: 1,
    text,
    confidence,
    bbox: { x: 50, y: 500, width: 120, height: 8, coordinateSpace: 'pdf-points' }
  }
}

test('extracts OCR reference candidates with source metadata and references', () => {
  const result = extractOcrReferenceCandidates([
    block('one', 'Ref CARD-100'),
    block('two', 'plain small text'),
    block('three', 'Invoice INV-777 receipt RCPT-9')
  ])

  assert.equal(result.summary.scannedPageCount, 1)
  assert.equal(result.summary.candidateCount, 2)
  assert.equal(result.summary.referenceCount, 3)
  assert.deepEqual(
    result.candidates.map((candidate) => [candidate.source, candidate.references]),
    [
      ['ocr-reference-scan', ['CARD-100']],
      ['ocr-reference-scan', ['INV-777', 'RCPT-9']]
    ]
  )
})

test('skips low-confidence OCR reference candidates', () => {
  const result = extractOcrReferenceCandidates(
    [block('one', 'Ref CARD-100', 0.3), block('two', 'Ref CARD-200', 0.7)],
    { minConfidence: 0.6 }
  )

  assert.equal(result.summary.candidateCount, 1)
  assert.equal(result.summary.skippedLowConfidenceCount, 1)
  assert.deepEqual(result.candidates[0]?.references, ['CARD-200'])
})

test('does not mutate OCR blocks while creating candidates', () => {
  const source = [block('one', 'Ref CARD-100')]
  const snapshot = structuredClone(source)

  extractOcrReferenceCandidates(source)

  assert.deepEqual(source, snapshot)
})
