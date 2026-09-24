import type {
  KeptExportDividerPlacement,
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

/** Default reference gap for templates created before the setting existed. */
const DEFAULT_REFERENCE_TOP_OFFSET_POINTS = 3
/** Five points of white space after the final payee/reference line. */
const ENTRY_BOTTOM_SPACING_POINTS = 5

function referenceStyle(
  style: KeptExportTextStyle,
  template: KeptExportPageTemplate
): KeptExportTextStyle {
  if (template.referenceTextStyle) return template.referenceTextStyle
  return { ...style, fontSize: Math.max(6, style.fontSize - 2), fontWeight: 'normal' }
}

function referenceGap(template: KeptExportPageTemplate): number {
  return Math.max(0, template.referenceGap ?? DEFAULT_REFERENCE_TOP_OFFSET_POINTS)
}

function lineCount(text: string, width: number, fontSize: number): number {
  const averageCharacterWidth = Math.max(1, fontSize * 0.55)
  const charactersPerLine = Math.max(1, Math.floor(width / averageCharacterWidth))
  return Math.max(1, Math.ceil(text.length / charactersPerLine))
}

function snippedLine(text: string, width: number, fontSize: number): string {
  const averageCharacterWidth = Math.max(1, fontSize * 0.55)
  const charactersPerLine = Math.max(1, Math.floor(width / averageCharacterWidth))
  if (text.length <= charactersPerLine) return text
  if (charactersPerLine <= 3) return text.slice(0, charactersPerLine)
  return `${text.slice(0, charactersPerLine - 3).trimEnd()}...`
}

function shouldSnipForReference(
  template: KeptExportPageTemplate,
  column: KeptExportColumn,
  reference: string
): boolean {
  return Boolean(
    template.showReferenceUnderMainText &&
    reference &&
    (column.sourceField === 'payee' || column.sourceField === 'text')
  )
}

function referenceColumn(template: KeptExportPageTemplate): KeptExportColumn | undefined {
  return (
    template.columns.find((column) => column.sourceField === 'payee') ??
    template.columns.find((column) => column.sourceField === 'text') ??
    template.columns[0]
  )
}

/** Content height for a single column's text, including its reference line when it is the anchor. */
function columnContentHeight(
  template: KeptExportPageTemplate,
  column: KeptExportColumn,
  row: KeptExportSourceRow,
  isAnchor: boolean
): number {
  const style = styleFor(template, column)
  if (isAnchor) {
    const reference = valueFor(row, 'reference')
    if (template.showReferenceUnderMainText && reference) {
      const referenceLineStyle = referenceStyle(style, template)
      return style.fontSize + referenceGap(template) + referenceLineStyle.fontSize
    }
  }
  const text = valueFor(row, column.sourceField)
  if (!text) return 0
  return lineCount(text, column.width, style.fontSize) * style.fontSize * 1.2
}

function pageTemplate(template: KeptExportTemplate, pageNumber: number): KeptExportPageTemplate {
  return pageNumber === 1 || !template.useSeparateLaterPages
    ? template.pageOneTemplate
    : template.laterPagesTemplate
}

interface RowGeometry {
  startY: number
  endY: number
  spacing: number
}

function rowGeometry(template: KeptExportPageTemplate, column: KeptExportColumn): RowGeometry {
  if (template.layoutMode === 'column-fill') {
    return {
      startY: template.fillBetweenY ? template.startY! : column.y,
      endY: template.fillBetweenY ? template.endY! : column.y + column.height,
      spacing: column.spacing
    }
  }
  const anchor = referenceColumn(template) ?? column
  return {
    startY: template.fillBetweenY ? template.startY! : anchor.y,
    endY: template.fillBetweenY ? template.endY! : anchor.y + anchor.height,
    spacing: anchor.spacing
  }
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
  const columns =
    template.layoutMode === 'table-row'
      ? [referenceColumn(template) ?? template.columns[0]!]
      : template.columns
  const fitting = columns.map((column) => Math.floor(range / column.spacing))
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
    const dividers: KeptExportDividerPlacement[] = []
    const rowPlacements =
      currentTemplate.layoutMode === 'column-fill'
        ? currentTemplate.columns.flatMap((column) =>
            pageRows.map((row, rowIndex) => ({ row, rowIndex, column }))
          )
        : pageRows.flatMap((row, rowIndex) =>
            currentTemplate.columns.map((column) => ({ row, rowIndex, column }))
          )
    const rowOffsets: number[] = []
    const rowContentHeights: number[] = []
    let nextRowOffset = 0
    pageRows.forEach((row, rowIndex) => {
      rowOffsets[rowIndex] = nextRowOffset
      const anchor = referenceColumn(currentTemplate)
      const geometry = rowGeometry(currentTemplate, anchor ?? currentTemplate.columns[0]!)
      const columnHeights =
        currentTemplate.layoutMode === 'table-row'
          ? currentTemplate.columns.map((column) =>
              columnContentHeight(currentTemplate, column, row, column === anchor)
            )
          : [anchor ? columnContentHeight(currentTemplate, anchor, row, true) : 0]
      const rowContentHeight = Math.max(0, ...columnHeights)
      rowContentHeights[rowIndex] = rowContentHeight
      nextRowOffset += Math.max(geometry.spacing, rowContentHeight) + ENTRY_BOTTOM_SPACING_POINTS
    })
    rowPlacements.forEach(({ row, rowIndex, column }) => {
      const text = valueFor(row, column.sourceField)
      const reference = valueFor(row, 'reference')
      if (!text) {
        warnings.push({
          code: 'missing-value',
          entryId: row.entryId,
          columnId: column.id,
          message: `${column.name} has no value for entry ${row.entryId}.`
        })
        return
      }
      const geometry = rowGeometry(currentTemplate, column)
      const isAnchor = column === referenceColumn(currentTemplate)
      // Centers shorter columns within the row's tallest entry so entries stay mid-row aligned.
      const centeringOffset =
        currentTemplate.layoutMode === 'table-row'
          ? Math.max(
              0,
              (rowContentHeights[rowIndex]! -
                columnContentHeight(currentTemplate, column, row, isAnchor)) /
                2
            )
          : 0
      const y = geometry.startY + rowOffsets[rowIndex]! + centeringOffset
      const style = styleFor(currentTemplate, column)
      if (y + geometry.spacing > geometry.endY) {
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
        text: shouldSnipForReference(currentTemplate, column, reference)
          ? snippedLine(text, column.width, style.fontSize)
          : text,
        x: column.x,
        y,
        width: column.width,
        height: geometry.spacing,
        ...(column.align ? { align: column.align } : {}),
        style
      })
    })
    if (currentTemplate.showReferenceUnderMainText) {
      const column = referenceColumn(currentTemplate)
      if (column) {
        for (const row of pageRows) {
          const reference = valueFor(row, 'reference')
          if (!reference) continue
          const anchor = placements.find(
            (placement) => placement.entryId === row.entryId && placement.columnId === column.id
          )
          if (!anchor) continue
          const style = referenceStyle(anchor.style, currentTemplate)
          placements.push({
            entryId: row.entryId,
            columnId: `${column.id}:reference`,
            pageNumber,
            text: `Ref: ${reference}`,
            x: anchor.x,
            y: anchor.y + anchor.style.fontSize + referenceGap(currentTemplate),
            width: anchor.width,
            ...(column.align ? { align: column.align } : {}),
            // The reference owns its own line box; the row offset reserves the 5pt clear space.
            height: style.fontSize,
            style
          })
        }
      }
    }
    if (currentTemplate.divider?.enabled) {
      const divider = currentTemplate.divider
      const dividerSpacing = Math.max(0, divider.spacing ?? 0)
      for (const row of pageRows) {
        const rowPlacements = placements.filter((placement) => placement.entryId === row.entryId)
        if (rowPlacements.length === 0) continue
        dividers.push({
          entryId: row.entryId,
          pageNumber,
          startX: divider.startX,
          endX: divider.endX,
          y:
            Math.max(...rowPlacements.map((placement) => placement.y + placement.height)) -
            dividerSpacing,
          thickness: divider.thickness,
          color: divider.color,
          opacity: divider.opacity
        })
      }
    }
    allPages.push({ pageNumber, template: currentTemplate, placements, dividers })
    rowOffset += pageRows.length
    pageNumber += 1
  }
  return { pages: allPages, warnings }
}
