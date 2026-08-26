import type { BoundingBox } from '../shared/contracts'
import type {
  ExtractedLine,
  ParsedPage,
  TableCandidate,
  TableColumnDefinition,
  TableTemplate
} from './types'

function unionLineBoxes(lines: readonly ExtractedLine[]): BoundingBox {
  const left = Math.min(...lines.map((line) => line.bbox.x))
  const bottom = Math.min(...lines.map((line) => line.bbox.y))
  const right = Math.max(...lines.map((line) => line.bbox.x + line.bbox.width))
  const top = Math.max(...lines.map((line) => line.bbox.y + line.bbox.height))
  return {
    x: left,
    y: bottom,
    width: right - left,
    height: top - bottom,
    coordinateSpace: 'pdf-points'
  }
}

function numericDensity(text: string): number {
  const tokens = text.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  return tokens.filter((token) => /\d/.test(token)).length / tokens.length
}

function matchesType(text: string, type: TableColumnDefinition['type']): boolean {
  const value = text.trim()
  if (!value) return false
  if (type === 'text') return true
  if (type === 'integer') return /^[+-]?\d{1,3}(?:[ ,.\u00a0]\d{3})*$/.test(value)
  if (type === 'decimal' || type === 'percentage') {
    return /^[+-]?(?:\d+[,.]?\d*|\d*[,.]\d+)%?$/.test(value)
  }
  if (type === 'currency') {
    return /^(?:[$€£]\s*)?[+-]?(?:\d{1,3}(?:[,.]\d{3})*|\d+)(?:[,.]\d{2})?(?:\s*[$€£])?$/.test(
      value
    )
  }
  return /^(?:\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,4}\s+[A-Za-z]{3,9}\s+\d{2,4})$/.test(value)
}

function validateTemplate(template: TableTemplate): void {
  if (template.columns.length === 0) throw new Error('A table template needs at least one column.')
  for (const column of template.columns) {
    if (!column.name.trim()) throw new Error('Table column names cannot be empty.')
    if (![column.xStart, column.xEnd].every(Number.isFinite) || column.xEnd <= column.xStart) {
      throw new Error(`Invalid x range for table column: ${column.name}.`)
    }
  }
  if (template.topY !== undefined && !Number.isFinite(template.topY)) {
    throw new Error('topY must be finite.')
  }
  if (template.bottomY !== undefined && !Number.isFinite(template.bottomY)) {
    throw new Error('bottomY must be finite.')
  }
  if (
    template.topY !== undefined &&
    template.bottomY !== undefined &&
    template.topY <= template.bottomY
  ) {
    throw new Error('topY must be greater than bottomY.')
  }
}

function detectTemplateCandidate(
  page: ParsedPage,
  lines: readonly ExtractedLine[],
  template: TableTemplate,
  columnTolerance: number
): TableCandidate | null {
  validateTemplate(template)
  const blocksById = new Map(page.blocks.map((block) => [block.id, block]))
  const header = template.headerLabels?.length
    ? lines.find((line) =>
        template.headerLabels!.every((label) =>
          line.text.toLocaleLowerCase().includes(label.toLocaleLowerCase())
        )
      )
    : undefined
  const rows = lines.filter((line) => {
    if (line.id === header?.id) return false
    const top = line.bbox.y + line.bbox.height
    const bottom = line.bbox.y
    return (
      (template.topY === undefined || top <= template.topY) &&
      (template.bottomY === undefined || bottom >= template.bottomY)
    )
  })
  const validRows = rows.filter((line) => {
    const cells = template.columns.map((column) => {
      const cellBlocks = line.blockIds
        .map((blockId) => blocksById.get(blockId))
        .filter(
          (block): block is NonNullable<typeof block> =>
            block !== undefined &&
            block.bbox.x + block.bbox.width >= column.xStart - columnTolerance &&
            block.bbox.x <= column.xEnd + columnTolerance
        )
      return (
        cellBlocks
          .map((block) => block.text)
          .join(' ')
          .trim() || undefined
      )
    })
    return template.columns.every((column, index) => {
      const cell = cells[index]
      return !column.required || (cell !== undefined && matchesType(cell, column.type))
    })
  })
  if (validRows.length < 2) return null
  return {
    id: `${page.documentId}:p${page.pageNumber}:t1`,
    documentId: page.documentId,
    pageNumber: page.pageNumber,
    rowLineIds: validRows.map((row) => row.id),
    columnCount: template.columns.length,
    bbox: unionLineBoxes(validRows),
    confidence: Math.min(0.99, 0.75 + validRows.length * 0.04),
    ...(header ? { headerLineId: header.id } : {}),
    templateName: template.name,
    validatedRowLineIds: validRows.map((row) => row.id),
    ...(template.columns.find((column) => column.totalBehavior && column.totalBehavior !== 'none')
      ? (() => {
          const column = template.columns.find(
            (candidate) => candidate.totalBehavior && candidate.totalBehavior !== 'none'
          )!
          return {
            totalColumn: {
              name: column.name,
              xStart: column.xStart,
              xEnd: column.xEnd,
              behavior: column.totalBehavior as 'add' | 'subtract'
            }
          }
        })()
      : {})
  }
}

export function detectTableCandidates(
  page: ParsedPage,
  lines: readonly ExtractedLine[],
  columnTolerance = 12,
  template?: TableTemplate
): TableCandidate[] {
  if (!Number.isFinite(columnTolerance) || columnTolerance < 0) {
    throw new Error('columnTolerance must be a non-negative number.')
  }
  if (template) {
    const candidate = detectTemplateCandidate(page, lines, template, columnTolerance)
    return candidate ? [candidate] : []
  }

  const blocksById = new Map(page.blocks.map((block) => [block.id, block]))
  const groups = new Map<number, ExtractedLine[]>()
  for (const line of lines) {
    if (line.blockIds.length < 2) continue
    const group = groups.get(line.blockIds.length) ?? []
    group.push(line)
    groups.set(line.blockIds.length, group)
  }

  const candidates: TableCandidate[] = []
  for (const [columnCount, rows] of groups) {
    if (rows.length < 2) continue
    const positions = rows.map((row) =>
      row.blockIds.map((id) => blocksById.get(id)?.bbox.x ?? Number.NaN)
    )
    const aligned = Array.from({ length: columnCount }, (_, columnIndex) => {
      const columnPositions = positions.map((row) => row[columnIndex] ?? Number.NaN)
      return (
        columnPositions.every(Number.isFinite) &&
        Math.max(...columnPositions) - Math.min(...columnPositions) <= columnTolerance
      )
    }).every(Boolean)
    if (!aligned) continue

    const density = rows.reduce((total, row) => total + numericDensity(row.text), 0) / rows.length
    const firstDensity = numericDensity(rows[0]?.text ?? '')
    const laterDensity =
      rows.slice(1).reduce((total, row) => total + numericDensity(row.text), 0) /
      Math.max(1, rows.length - 1)
    const headerLineId = firstDensity < laterDensity ? rows[0]?.id : undefined

    candidates.push({
      id: `${page.documentId}:p${page.pageNumber}:t${candidates.length + 1}`,
      documentId: page.documentId,
      pageNumber: page.pageNumber,
      rowLineIds: rows.map((row) => row.id),
      columnCount,
      bbox: unionLineBoxes(rows),
      confidence: Math.min(0.98, 0.65 + rows.length * 0.04 + density * 0.2),
      ...(headerLineId ? { headerLineId } : {})
    })
  }

  return candidates
}
