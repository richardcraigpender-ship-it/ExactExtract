import type {
  KeptExportColumn,
  KeptExportPage,
  KeptExportPageTemplate,
  KeptExportPlacement,
  KeptExportRenderPlan,
  KeptExportSourceField,
  KeptExportSourceRow,
  KeptExportTemplate,
  KeptExportTextStyle
} from '../shared/keptExportTemplate'

function valueFor(row: KeptExportSourceRow, field: KeptExportSourceField): string {
  return row.values[field] ?? ''
}

function styleFor(template: KeptExportPageTemplate, column: KeptExportColumn): KeptExportTextStyle {
  return column.textStyle ?? template.defaultTextStyle
}

function pageTemplate(template: KeptExportTemplate, pageNumber: number): KeptExportPageTemplate {
  return pageNumber === 1 || !template.useSeparateLaterPages
    ? template.pageOneTemplate
    : template.laterPagesTemplate
}

function effectiveEntriesPerPage(template: KeptExportPageTemplate): number {
  const { startY, endY } = template
  if (
    !template.fillBetweenY ||
    !Number.isFinite(startY) ||
    !Number.isFinite(endY) ||
    endY === undefined ||
    startY === undefined ||
    endY <= startY
  ) {
    return template.entriesPerPage
  }
  const range = endY - startY
  const fitting = template.columns.map((column) => Math.floor(range / column.spacing))
  return Math.max(1, Math.min(template.entriesPerPage, ...fitting))
}

export function buildKeptExportRenderPlan(
  rows: readonly KeptExportSourceRow[],
  template: KeptExportTemplate
): KeptExportRenderPlan {
  const warnings: KeptExportRenderPlan['warnings'] = []
  const allPages: KeptExportPage[] = []
  if (template.pageOneTemplate.columns.length === 0) {
    warnings.push({ code: 'no-columns', message: 'Page 1 has no columns.' })
  }
  if (template.useSeparateLaterPages && template.laterPagesTemplate.columns.length === 0) {
    warnings.push({ code: 'no-columns', message: 'Later pages have no columns.' })
  }

  let rowOffset = 0
  let pageNumber = 1
  while (rowOffset < rows.length || pageNumber === 1) {
    const currentTemplate = pageTemplate(template, pageNumber)
    const pageRows = rows.slice(rowOffset, rowOffset + effectiveEntriesPerPage(currentTemplate))
    const placements: KeptExportPlacement[] = []
    const rowPlacements =
      currentTemplate.layoutMode === 'column-fill'
        ? currentTemplate.columns.flatMap((column) =>
            pageRows.map((row, rowIndex) => ({ row, rowIndex, column }))
          )
        : pageRows.flatMap((row, rowIndex) =>
            currentTemplate.columns.map((column) => ({ row, rowIndex, column }))
          )
    rowPlacements.forEach(({ row, rowIndex, column }) => {
      const text = valueFor(row, column.sourceField)
      if (!text) {
        warnings.push({
          code: 'missing-value',
          entryId: row.entryId,
          columnId: column.id,
          message: `${column.name} has no value for entry ${row.entryId}.`
        })
        return
      }
      const firstRowY = currentTemplate.fillBetweenY ? currentTemplate.startY! : column.y
      const endY = currentTemplate.fillBetweenY ? currentTemplate.endY! : column.y + column.height
      const y = firstRowY + rowIndex * column.spacing
      if (y + column.spacing > endY) {
        warnings.push({
          code: 'overflow',
          entryId: row.entryId,
          columnId: column.id,
          message: `${column.name} overflows page ${pageNumber}.`
        })
      }
      placements.push({
        entryId: row.entryId,
        columnId: column.id,
        pageNumber,
        text,
        x: column.x,
        y,
        width: column.width,
        height: column.spacing,
        style: styleFor(currentTemplate, column)
      })
    })
    allPages.push({ pageNumber, template: currentTemplate, placements })
    rowOffset += pageRows.length
    pageNumber += 1
  }
  return { pages: allPages, warnings }
}
