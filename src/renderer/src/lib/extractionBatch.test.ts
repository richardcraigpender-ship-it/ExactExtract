import assert from 'node:assert/strict'
import test from 'node:test'

import { ExtractionBatchError, runExtractionBatch } from './extractionBatch'

const documents = [
  { id: 'document-1', name: 'First.pdf', path: 'C:\\First.pdf' },
  { id: 'document-2', name: 'Second.pdf', path: 'C:\\Second.pdf' }
]

test('reports document and overall OCR progress through a successful batch', async () => {
  const progress: number[] = []
  const results = await runExtractionBatch(documents, {
    extract: async (document, onProgress) => {
      onProgress({ stage: 'recognizing', progress: 0.5 })
      return document.id
    },
    onProgress: (value) => progress.push(value.overallProgress)
  })

  assert.deepEqual(results, ['document-1', 'document-2'])
  assert.deepEqual(progress, [0.25, 0.5, 0.75, 1])
})

test('returns completed document results with an actionable later-document failure', async () => {
  await assert.rejects(
    runExtractionBatch(documents, {
      extract: async (document) => {
        if (document.id === 'document-2') throw new Error('Page image could not be rendered.')
        return document.id
      }
    }),
    (error: unknown) => {
      assert.ok(error instanceof ExtractionBatchError)
      assert.equal(error.failedDocument.id, 'document-2')
      assert.deepEqual(error.completedResults, ['document-1'])
      assert.match(error.message, /Second\.pdf.*Page image could not be rendered/)
      return true
    }
  )
})

test('stops before the next document when cancellation is requested', async () => {
  const controller = new AbortController()
  const started: string[] = []

  await assert.rejects(
    runExtractionBatch(documents, {
      signal: controller.signal,
      extract: async (document) => {
        started.push(document.id)
        controller.abort()
        return document.id
      }
    }),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError'
  )
  assert.deepEqual(started, ['document-1'])
})
