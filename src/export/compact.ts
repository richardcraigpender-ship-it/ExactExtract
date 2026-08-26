import type { ProjectEntry } from '../shared/contracts'

export interface CompactSourceRow {
  entry: ProjectEntry
  documentId: string
  sourcePageNumber: number
  pageNumber: number
  x: number
  sourceY: number
  targetY: number
  width: number
  sourceHeight: number
  height: number
}

interface SourceRow extends Omit<CompactSourceRow, 'targetY'> {}

function pageKey(documentId: string, pageNumber: number): string {
  return `${documentId}:${pageNumber}`
}

export interface CompactSourceRowContract {
  entry: ProjectEntry
  documentId: string
  pageNumber: number
  x: number
  sourceY: number
  width: number
  height: number
  isExcluded: boolean
}

export function prepareCompactSourceRows(
  entries: readonly ProjectEntry[],
  pageHeights: ReadonlyMap<string, number>,
  isRemoved: (entry: ProjectEntry) => boolean = (entry) => entry.status === 'exclude'
): CompactSourceRowContract[] {
  const rowsByPage = new Map<string, CompactSourceRowContract[]>()

  for (const entry of entries) {
    const regionsByPage = new Map<string, NonNullable<ProjectEntry['regions'][number]['bbox']>[]>()
    for (const region of entry.regions) {
      const box = region.bbox
      if (!box || box.coordinateSpace !== 'pdf-points') continue
      const key = pageKey(region.documentId, region.pageNumber)
      const boxes = regionsByPage.get(key) ?? []
      boxes.push(box)
      regionsByPage.set(key, boxes)
    }

    for (const [key, boxes] of regionsByPage) {
      const separator = key.lastIndexOf(':')
      const left = Math.min(...boxes.map((box) => box.x))
      const bottom = Math.min(...boxes.map((box) => box.y))
      const right = Math.max(...boxes.map((box) => box.x + box.width))
      const top = Math.max(...boxes.map((box) => box.y + box.height))
      const pageRows = rowsByPage.get(key) ?? []
      pageRows.push({
        entry,
        documentId: key.slice(0, separator),
        pageNumber: Number(key.slice(separator + 1)),
        x: left,
        sourceY: bottom,
        width: right - left,
        height: top - bottom,
        isExcluded: isRemoved(entry)
      })
      rowsByPage.set(key, pageRows)
    }
  }

  const orderedPages = [...rowsByPage.entries()].sort(([, leftRows], [, rightRows]) => {
    const left = leftRows[0]!
    const right = rightRows[0]!
    return left.documentId.localeCompare(right.documentId) || left.pageNumber - right.pageNumber
  })

  const prepared: CompactSourceRowContract[] = []
  for (const [key, pageRows] of orderedPages) {
    const pageHeight = pageHeights.get(key)
    if (!Number.isFinite(pageHeight) || pageHeight === undefined || pageHeight <= 0) continue
    prepared.push(
      ...pageRows.sort(
        (left, right) =>
          right.sourceY - left.sourceY ||
          left.x - right.x ||
          left.entry.id.localeCompare(right.entry.id)
      )
    )
  }

  return prepared
}

export function buildCompactSourceRows(
  entries: readonly ProjectEntry[],
  rowHeight: number,
  pageHeights: ReadonlyMap<string, number>,
  resolveHeight?: (row: CompactSourceRowContract) => number,
  isRemoved?: (entry: ProjectEntry) => boolean
): CompactSourceRow[] {
  if (!Number.isFinite(rowHeight) || rowHeight <= 0) {
    throw new Error('Row height must be a positive PDF-point value.')
  }

  const rowsByPage = new Map<string, Array<SourceRow & { isExcluded: boolean }>>()
  for (const row of prepareCompactSourceRows(entries, pageHeights, isRemoved)) {
    const height = resolveHeight?.(row) ?? row.height
    if (!Number.isFinite(height) || height <= 0) {
      throw new Error(`Compacted row height must be positive for entry ${row.entry.id}.`)
    }
    const key = pageKey(row.documentId, row.pageNumber)
    const rows = rowsByPage.get(key) ?? []
    rows.push({
      entry: row.entry,
      documentId: row.documentId,
      sourcePageNumber: row.pageNumber,
      pageNumber: row.pageNumber,
      x: row.x,
      sourceY: row.sourceY,
      width: row.width,
      sourceHeight: row.height,
      height,
      isExcluded: row.isExcluded
    })
    rowsByPage.set(key, rows)
  }

  const compacted: CompactSourceRow[] = []
  const orderedPages = [...rowsByPage.entries()].sort(([, leftRows], [, rightRows]) => {
    const left = leftRows[0]!
    const right = rightRows[0]!
    return left.documentId.localeCompare(right.documentId) || left.pageNumber - right.pageNumber
  })
  for (const [key, pageRows] of orderedPages) {
    const pageHeight = pageHeights.get(key)
    if (!Number.isFinite(pageHeight) || pageHeight === undefined || pageHeight <= 0) continue
    const orderedRows = pageRows.sort(
      (left, right) =>
        right.sourceY - left.sourceY ||
        left.x - right.x ||
        left.entry.id.localeCompare(right.entry.id)
    )
    // Content never legitimately appeared above this point in the source page, so compacted
    // rows must never be pushed higher than it either (guards against drawing over a page
    // header/logo, which is never modeled as a tracked entry).
    const originalContentCeiling = Math.max(
      ...pageRows.map((row) => row.sourceY + row.sourceHeight)
    )
    let removedHeight = 0
    const placedRows: CompactSourceRow[] = []
    for (const row of orderedRows) {
      if (row.isExcluded) {
        // Use this row's own freed space, not a flat nominal row height: real extracted rows
        // vary in height, and a fixed shift drifts remaining rows out of position as exclusions
        // accumulate.
        removedHeight += row.sourceHeight
        continue
      }
      const collisionCeiling = placedRows
        .filter((placed) => row.x < placed.x + placed.width && row.x + row.width > placed.x)
        .reduce((ceiling, placed) => Math.min(ceiling, placed.targetY), pageHeight)
      const targetY = Math.min(
        row.sourceY + removedHeight,
        pageHeight - row.height,
        collisionCeiling - row.height,
        originalContentCeiling - row.height
      )
      if (targetY < 0) {
        throw new Error(`Compacted rows do not fit on source page ${row.pageNumber}.`)
      }
      const compactedRow = { ...row, targetY }
      compacted.push(compactedRow)
      placedRows.push(compactedRow)
    }
  }

  return compacted
}

const CARRYOVER_THRESHOLD = 72 // ~1 inch from top of page

interface PageRowGroup {
  pageKey: string
  documentId: string
  pageNumber: number
  rows: CompactSourceRow[]
  pageHeight: number
}

export function applyPageForwardCarryover(
  rows: CompactSourceRow[],
  pageHeights: ReadonlyMap<string, number>,
  continuationThreshold: number = CARRYOVER_THRESHOLD
): CompactSourceRow[] {
  // Group rows by page
  const pageGroups = new Map<string, PageRowGroup>()
  for (const row of rows) {
    const key = pageKey(row.documentId, row.pageNumber)
    if (!pageGroups.has(key)) {
      const pageHeight = pageHeights.get(key) ?? 792
      pageGroups.set(key, {
        pageKey: key,
        documentId: row.documentId,
        pageNumber: row.pageNumber,
        rows: [],
        pageHeight
      })
    }
    pageGroups.get(key)!.rows.push(row)
  }

  // Keep each document's pages contiguous for previous-page carryover.
  const sortedPages = Array.from(pageGroups.values()).sort(
    (a, b) => a.documentId.localeCompare(b.documentId) || a.pageNumber - b.pageNumber
  )

  // Process each page for carryover opportunities
  const carryoverMap = new Map<string, CompactSourceRow[]>()
  for (let i = 0; i < sortedPages.length; i++) {
    const currentPage = sortedPages[i]
    const prevPage = i > 0 ? sortedPages[i - 1] : null

    if (!prevPage) continue

    // Find rows at the top of the current page that could be continuations
    const topRowsOnCurrentPage = currentPage.rows.filter(
      (row) => row.targetY >= currentPage.pageHeight - continuationThreshold
    )

    const carried: CompactSourceRow[] = []
    const destinationRows = [...(carryoverMap.get(prevPage.pageKey) || prevPage.rows)]
    for (const candidate of topRowsOnCurrentPage) {
      // Check if this row can fit at the bottom of the previous page
      if (prevPage.documentId !== candidate.documentId) continue // Must be same document

      const lowestRowOnPrevPage = Math.min(
        ...destinationRows.map((row) => row.targetY),
        prevPage.pageHeight
      )

      // Check if there's space: candidate height + margin must not exceed lowestRowOnPrevPage
      const requiredSpace = candidate.height + 6 // 6 points margin
      if (lowestRowOnPrevPage - requiredSpace < 0) continue // Doesn't fit

      // Compute new target Y on previous page (just above the lowest row)
      const newTargetY = lowestRowOnPrevPage - requiredSpace

      // Preserve reading order: new position must be coherent
      if (newTargetY < 0) continue

      // Mark for carryover
      const carriedRow = {
        ...candidate,
        pageNumber: prevPage.pageNumber,
        targetY: newTargetY
      }
      carried.push(carriedRow)
      destinationRows.push(carriedRow)
    }

    // Apply carried-over rows
    if (carried.length > 0) {
      carryoverMap.set(
        currentPage.pageKey,
        currentPage.rows.filter((r) => !carried.some((c) => c.entry.id === r.entry.id))
      )
      carryoverMap.set(prevPage.pageKey, destinationRows)
    }
  }

  // Rebuild result with carryover applied
  const result: CompactSourceRow[] = []
  for (const group of sortedPages) {
    const pageRows = carryoverMap.get(group.pageKey) || group.rows
    result.push(...pageRows)
  }

  // Re-sort by page and target Y for consistency
  return result.sort(
    (a, b) =>
      a.documentId.localeCompare(b.documentId) ||
      a.pageNumber - b.pageNumber ||
      b.targetY - a.targetY
  )
}
