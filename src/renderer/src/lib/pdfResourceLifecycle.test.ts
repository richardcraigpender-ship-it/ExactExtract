import assert from 'node:assert/strict'
import test from 'node:test'

import { withPdfDocument } from './pdfResourceLifecycle'

test('destroys a loaded PDF document after successful use', async () => {
  let destroyCount = 0
  const document = {
    destroy: async () => {
      destroyCount += 1
    }
  }

  const result = await withPdfDocument(
    async () => document,
    async () => 'complete'
  )

  assert.equal(result, 'complete')
  assert.equal(destroyCount, 1)
})

test('destroys a loaded PDF document when use fails or is cancelled', async () => {
  for (const failure of [new Error('parse failed'), new DOMException('cancelled', 'AbortError')]) {
    let destroyCount = 0
    const document = {
      destroy: async () => {
        destroyCount += 1
      }
    }

    await assert.rejects(
      withPdfDocument(
        async () => document,
        async () => Promise.reject(failure)
      ),
      failure
    )
    assert.equal(destroyCount, 1)
  }
})

test('does not attempt cleanup when loading the PDF document fails', async () => {
  let used = false

  await assert.rejects(
    withPdfDocument(
      async () => Promise.reject(new Error('load failed')),
      async () => {
        used = true
      }
    ),
    /load failed/
  )
  assert.equal(used, false)
})
