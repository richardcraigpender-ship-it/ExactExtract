import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument } from 'pdf-lib'
import {
  hasPdfHeader,
  removePdfPages,
  remapPageNumber,
  restoreOriginalPageNumber
} from './removePdfPages'

test('recognizes valid PDF headers and rejects non-PDF bytes', () => {
  assert.equal(hasPdfHeader(new TextEncoder().encode('%PDF-1.7')), true)
  assert.equal(hasPdfHeader(new TextEncoder().encode('not a PDF')), false)
})

test('removes the requested PDF pages and preserves the remaining page count', async () => {
  const source = await PDFDocument.create()
  source.addPage([100, 100])
  source.addPage([200, 200])
  source.addPage([300, 300])
  source.addPage([400, 400])

  const result = await removePdfPages(await source.save(), [3, 4])
  const output = await PDFDocument.load(result.bytes)

  assert.equal(result.pageCount, 2)
  assert.deepEqual(result.removedPages, [3, 4])
  assert.equal(output.getPageCount(), 2)
  assert.deepEqual(output.getPage(1).getSize(), { width: 200, height: 200 })
})

test('remaps pages after removed ranges and rejects removing every page', async () => {
  assert.equal(remapPageNumber(1, [2, 3]), 1)
  assert.equal(remapPageNumber(2, [2, 3]), null)
  assert.equal(remapPageNumber(4, [2, 3]), 2)

  const source = await PDFDocument.create()
  source.addPage([100, 100])
  await assert.rejects(async () => removePdfPages(await source.save(), [1]), /At least one page/)
})

test('restores current page selections to original page numbers after prior removals', () => {
  assert.equal(restoreOriginalPageNumber(1, 5, [2]), 1)
  assert.equal(restoreOriginalPageNumber(2, 5, [2]), 3)
  assert.equal(restoreOriginalPageNumber(4, 5, [2]), 5)
  assert.equal(restoreOriginalPageNumber(2, 5, [2, 4]), 3)
  assert.equal(restoreOriginalPageNumber(4, 5, [2, 4]), null)
})
