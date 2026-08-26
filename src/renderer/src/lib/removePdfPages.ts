import { PDFDocument } from 'pdf-lib'

export interface RemovedPdfPages {
  bytes: Uint8Array
  pageCount: number
  removedPages: number[]
}

export function hasPdfHeader(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-'
}

export async function removePdfPages(
  sourceBytes: Uint8Array,
  pagesToRemove: readonly number[]
): Promise<RemovedPdfPages> {
  if (!hasPdfHeader(sourceBytes)) {
    throw new Error('The active document is not valid PDF data.')
  }
  const sourcePdf = await PDFDocument.load(sourceBytes)
  const pageCount = sourcePdf.getPageCount()
  const removedPages = [...new Set(pagesToRemove)]
    .filter((page) => Number.isInteger(page) && page >= 1 && page <= pageCount)
    .sort((left, right) => left - right)

  if (removedPages.length === 0) {
    throw new Error('Select at least one valid page to remove.')
  }
  if (removedPages.length >= pageCount) {
    throw new Error('At least one page must remain in the document.')
  }

  const removed = new Set(removedPages)
  const outputPdf = await PDFDocument.create()
  const keptPageIndices = sourcePdf
    .getPageIndices()
    .filter((pageIndex) => !removed.has(pageIndex + 1))
  const copiedPages = await outputPdf.copyPages(sourcePdf, keptPageIndices)
  copiedPages.forEach((page) => outputPdf.addPage(page))

  return {
    bytes: await outputPdf.save(),
    pageCount: keptPageIndices.length,
    removedPages
  }
}

export function remapPageNumber(
  pageNumber: number,
  removedPages: readonly number[]
): number | null {
  if (removedPages.includes(pageNumber)) return null
  return pageNumber - removedPages.filter((page) => page < pageNumber).length
}

export function restoreOriginalPageNumber(
  pageNumber: number,
  originalPageCount: number,
  removedPages: readonly number[]
): number | null {
  const removed = new Set(removedPages)
  let currentPage = 0
  for (let originalPage = 1; originalPage <= originalPageCount; originalPage += 1) {
    if (removed.has(originalPage)) continue
    currentPage += 1
    if (currentPage === pageNumber) return originalPage
  }
  return null
}
