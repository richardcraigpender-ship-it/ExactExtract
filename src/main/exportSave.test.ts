import assert from 'node:assert/strict'
import test from 'node:test'

import { saveExportRequest, validateExportRequest, type ExportDialogOptions } from './exportSave'

test('sanitizes names, enforces extension, and requests overwrite confirmation', async () => {
  let options: ExportDialogOptions | undefined
  let written: { path: string; content: string | Uint8Array } | undefined
  const result = await saveExportRequest(
    { format: 'csv', suggestedName: 'report:final.json', content: 'a,b\r\n1,2' },
    async (value) => {
      options = value
      return { canceled: false, filePath: 'C:\\Exports\\report' }
    },
    async (path, content) => {
      written = { path, content }
    }
  )

  assert.deepEqual(result, { status: 'saved', path: 'C:\\Exports\\report.csv' })
  assert.equal(options?.defaultPath, 'report-final.csv')
  assert.equal(options?.showOverwriteConfirmation, true)
  assert.equal(written?.path, 'C:\\Exports\\report.csv')
})

test('returns cancellation without writing', async () => {
  let writes = 0
  const result = await saveExportRequest(
    { format: 'json', suggestedName: 'review', content: '{}' },
    async () => ({ canceled: true }),
    async () => {
      writes += 1
    }
  )

  assert.deepEqual(result, { status: 'cancelled' })
  assert.equal(writes, 0)
})

test('validates PDF signature and propagates write failures', async () => {
  await assert.rejects(
    saveExportRequest(
      {
        format: 'pdf',
        suggestedName: 'review',
        content: Buffer.from('invalid').toString('base64')
      },
      async () => ({ canceled: false, filePath: 'review.pdf' }),
      async () => undefined
    ),
    /PDF export content is invalid/
  )
  await assert.rejects(
    saveExportRequest(
      { format: 'json', suggestedName: 'review', content: '{}' },
      async () => ({ canceled: false, filePath: 'review.json' }),
      async () => {
        throw new Error('disk full')
      }
    ),
    /disk full/
  )
})

test('rejects unsupported formats and oversized content', () => {
  assert.throws(
    () => validateExportRequest({ format: 'html', suggestedName: 'review', content: '' }),
    /format/
  )
  assert.throws(
    () =>
      validateExportRequest({
        format: 'json',
        suggestedName: 'review',
        content: 'x'.repeat(50 * 1024 * 1024 + 1)
      }),
    /50 MB/
  )
})
