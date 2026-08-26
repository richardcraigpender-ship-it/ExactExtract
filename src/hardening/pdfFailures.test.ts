import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import test from 'node:test'

import {
  classifyPdfFailure,
  DEFAULT_PDF_LIMITS,
  validatePdfImportBatch,
  validatePdfLimits
} from './pdfFailures'

test('enforces documented file and page limits', () => {
  assert.equal(validatePdfLimits(DEFAULT_PDF_LIMITS.maxFileBytes), null)
  assert.equal(validatePdfLimits(DEFAULT_PDF_LIMITS.maxFileBytes + 1)?.code, 'oversized')
  assert.equal(validatePdfLimits(10, DEFAULT_PDF_LIMITS.maxPageCount + 1)?.code, 'too-many-pages')
})

test('classifies encrypted, corrupt, missing, and unsupported failures', () => {
  assert.equal(classifyPdfFailure(new Error('PasswordException')).code, 'encrypted')
  assert.equal(classifyPdfFailure(new Error('Invalid PDF structure')).code, 'corrupt')
  assert.equal(classifyPdfFailure(new Error('ENOENT no such file')).code, 'missing-source')
  assert.equal(classifyPdfFailure(new Error('Unsupported format')).code, 'unsupported')
})

test('classifies a real password-protected PDF with actionable unlock guidance', async () => {
  const result = classifyPdfFailure(await loadFixtureFailure('encrypted-password.pdf'))

  assert.equal(result.code, 'encrypted')
  assert.equal(result.title, 'Password-protected PDF')
  assert.match(result.message, /Unlock this PDF.*save an unprotected copy/i)
  assert.equal(result.recoverable, true)
})

test('classifies a real malformed PDF with actionable replacement guidance', async () => {
  const result = classifyPdfFailure(await loadFixtureFailure('malformed-truncated.pdf'))

  assert.equal(result.code, 'corrupt')
  assert.equal(result.title, 'Unreadable PDF')
  assert.match(result.message, /damaged or incomplete.*fresh copy/i)
  assert.equal(result.recoverable, true)
})

test('rejects an oversized or 51st unique document without counting duplicates twice', () => {
  const existing = Array.from({ length: 49 }, (_, index) => `document-${index}.pdf`)
  assert.equal(
    validatePdfImportBatch(existing, [
      { path: existing[0]!, size: 10 },
      { path: 'document-49.pdf', size: 10 }
    ]),
    null
  )
  assert.equal(
    validatePdfImportBatch(existing, [
      { path: 'document-49.pdf', size: 10 },
      { path: 'document-50.pdf', size: 10 }
    ])?.code,
    'too-many-documents'
  )
  assert.equal(
    validatePdfImportBatch(
      [],
      [{ path: 'oversized.pdf', size: DEFAULT_PDF_LIMITS.maxFileBytes + 1 }]
    )?.code,
    'oversized'
  )
})

test('validates an import batch without mutating paths or accepting invalid sizes', () => {
  const existing = ['already.pdf']
  const incoming = [
    { path: 'new.pdf', size: 10 },
    { path: 'already.pdf', size: Number.NaN }
  ]

  assert.equal(validatePdfImportBatch(existing, incoming)?.code, 'corrupt')
  assert.deepEqual(existing, ['already.pdf'])
  assert.deepEqual(incoming, [
    { path: 'new.pdf', size: 10 },
    { path: 'already.pdf', size: Number.NaN }
  ])
})

test('preserves useful unknown error details without exposing source data', () => {
  const result = classifyPdfFailure(new Error('Worker stopped unexpectedly'))
  assert.equal(result.code, 'unknown')
  assert.equal(result.message, 'Worker stopped unexpectedly')
})

async function loadFixtureFailure(name: string): Promise<unknown> {
  const bytes = new Uint8Array(await readFile(`test-data/fixtures/${name}`))
  const loadingTask = getDocument({ data: bytes, disableWorker: true })
  let failure: unknown

  try {
    await loadingTask.promise
  } catch (error) {
    failure = error
  } finally {
    await loadingTask.destroy()
  }

  assert.ok(failure, `${name} unexpectedly loaded as a valid PDF`)
  return failure
}
