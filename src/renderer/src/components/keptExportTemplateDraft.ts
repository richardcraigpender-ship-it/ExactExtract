import type {
  KeptEntriesBackground,
  KeptEntriesFontRef,
  KeptEntriesOrientation,
  KeptEntriesPageSize
} from '../../../shared/keptEntriesLayout'
import { getCanvasPageDimensions } from '../lib/canvasScale'
import type { KeptExportTemplate } from '../../../shared/keptExportTemplate'

export type KeptExportLayoutMode = 'column-fill' | 'table-row'
export type KeptExportTemplateTarget = 'page-one' | 'later-pages'
export type KeptExportOverflowBehavior = 'wrap' | 'clip' | 'next-page'
export type KeptExportSourceField =
  'text' | 'payee' | 'date' | 'money-out' | 'money-in' | 'balance' | 'category' | 'reference'

export type KeptExportSummaryField =
  | 'money-in-total'
  | 'money-out-total'
  | 'net-movement'
  | 'balance-snapshot-total'
  | 'opening-balance'
  | 'calculated-closing-balance'
  | 'statement-closing-balance'
  | 'reconciliation-difference'

export interface KeptExportTextStyle {
  fontRef: KeptEntriesFontRef
  fontSize: number
  color: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
}

export interface KeptExportColumnDraft {
  id: string
  name: string
  sourceField: KeptExportSourceField
  x: number
  y: number
  width: number
  height: number
  spacing: number
  overflow: KeptExportOverflowBehavior
  textStyle?: KeptExportTextStyle
}

export interface KeptExportPageTemplateDraft {
  pageSize: KeptEntriesPageSize
  orientation: KeptEntriesOrientation
  layoutMode: KeptExportLayoutMode
  entriesPerPage: number
  defaultTextStyle: KeptExportTextStyle
  columns: KeptExportColumnDraft[]
  background?: KeptEntriesBackground
}

export interface KeptExportTemplateDraft {
  useSeparateLaterPages: boolean
  pageOneTemplate: KeptExportPageTemplateDraft
  laterPagesTemplate: KeptExportPageTemplateDraft
  summaryFields: KeptExportSummaryField[]
}

export interface KeptExportTemplateValidationIssue {
  path: string
  message: string
}

const DEFAULT_TEXT_STYLE: KeptExportTextStyle = {
  fontRef: { kind: 'standard-14', family: 'Helvetica' },
  fontSize: 11,
  color: '#17231c',
  fontWeight: 'normal',
  fontStyle: 'normal'
}

const DEFAULT_COLUMN_SPECS: Array<
  Pick<KeptExportColumnDraft, 'id' | 'name' | 'sourceField' | 'x' | 'width'>
> = [
  { id: 'payee', name: 'Payee', sourceField: 'payee', x: 48, width: 270 },
  { id: 'money-out', name: 'Money out', sourceField: 'money-out', x: 326, width: 72 },
  { id: 'money-in', name: 'Money in', sourceField: 'money-in', x: 406, width: 72 },
  { id: 'balance', name: 'Balance', sourceField: 'balance', x: 486, width: 78 }
]

export function cloneKeptExportTextStyle(style: KeptExportTextStyle): KeptExportTextStyle {
  return { ...style, fontRef: { ...style.fontRef } }
}

export function cloneKeptExportPageTemplate(
  template: KeptExportPageTemplateDraft
): KeptExportPageTemplateDraft {
  return {
    ...template,
    defaultTextStyle: cloneKeptExportTextStyle(template.defaultTextStyle),
    columns: template.columns.map((column) => ({
      ...column,
      textStyle: column.textStyle ? cloneKeptExportTextStyle(column.textStyle) : undefined
    })),
    background: template.background ? { ...template.background } : undefined
  }
}

export function cloneKeptExportTemplateDraft(
  draft: KeptExportTemplateDraft
): KeptExportTemplateDraft {
  return {
    ...draft,
    pageOneTemplate: cloneKeptExportPageTemplate(draft.pageOneTemplate),
    laterPagesTemplate: cloneKeptExportPageTemplate(draft.laterPagesTemplate),
    summaryFields: [...draft.summaryFields]
  }
}

export function createDefaultKeptExportPageTemplate(): KeptExportPageTemplateDraft {
  return {
    pageSize: 'letter',
    orientation: 'portrait',
    layoutMode: 'table-row',
    entriesPerPage: 20,
    defaultTextStyle: cloneKeptExportTextStyle(DEFAULT_TEXT_STYLE),
    columns: DEFAULT_COLUMN_SPECS.map((column) => ({
      ...column,
      y: 72,
      height: 648,
      spacing: 28,
      overflow: 'next-page'
    }))
  }
}

export function createDefaultKeptExportTemplateDraft(): KeptExportTemplateDraft {
  const pageOneTemplate = createDefaultKeptExportPageTemplate()
  return {
    useSeparateLaterPages: false,
    pageOneTemplate,
    laterPagesTemplate: cloneKeptExportPageTemplate(pageOneTemplate),
    summaryFields: []
  }
}

export function setSeparateLaterPages(
  draft: KeptExportTemplateDraft,
  separate: boolean
): KeptExportTemplateDraft {
  if (draft.useSeparateLaterPages === separate) return cloneKeptExportTemplateDraft(draft)
  return {
    ...cloneKeptExportTemplateDraft(draft),
    useSeparateLaterPages: separate,
    laterPagesTemplate: separate
      ? cloneKeptExportPageTemplate(draft.pageOneTemplate)
      : cloneKeptExportPageTemplate(draft.laterPagesTemplate)
  }
}

export function getDraftTemplate(
  draft: KeptExportTemplateDraft,
  target: KeptExportTemplateTarget
): KeptExportPageTemplateDraft {
  return target === 'later-pages' ? draft.laterPagesTemplate : draft.pageOneTemplate
}

export function updateDraftTemplate(
  draft: KeptExportTemplateDraft,
  target: KeptExportTemplateTarget,
  update: (template: KeptExportPageTemplateDraft) => KeptExportPageTemplateDraft
): KeptExportTemplateDraft {
  const next = cloneKeptExportTemplateDraft(draft)
  if (target === 'later-pages') {
    next.laterPagesTemplate = update(next.laterPagesTemplate)
  } else {
    next.pageOneTemplate = update(next.pageOneTemplate)
  }
  return next
}

export function createKeptExportColumn(
  index: number,
  id: string = `column-${index + 1}`
): KeptExportColumnDraft {
  return {
    id,
    name: `Column ${index + 1}`,
    sourceField: 'text',
    x: 48,
    y: 72,
    width: 180,
    height: 648,
    spacing: 28,
    overflow: 'next-page'
  }
}

export function applyTextStyle(
  template: KeptExportPageTemplateDraft,
  style: KeptExportTextStyle,
  applyToAll: boolean,
  selectedColumnId?: string
): KeptExportPageTemplateDraft {
  if (applyToAll) {
    return {
      ...template,
      defaultTextStyle: cloneKeptExportTextStyle(style),
      columns: template.columns.map((column) => ({
        ...column,
        textStyle: cloneKeptExportTextStyle(style)
      }))
    }
  }
  if (!selectedColumnId) return template
  return {
    ...template,
    columns: template.columns.map((column) =>
      column.id === selectedColumnId
        ? { ...column, textStyle: cloneKeptExportTextStyle(style) }
        : column
    )
  }
}

export function validateKeptExportPageTemplate(
  template: KeptExportPageTemplateDraft,
  label: string
): KeptExportTemplateValidationIssue[] {
  const dimensions = getCanvasPageDimensions(template.pageSize, template.orientation)
  const issues: KeptExportTemplateValidationIssue[] = []
  if (!Number.isInteger(template.entriesPerPage) || template.entriesPerPage < 1) {
    issues.push({ path: `${label}.entriesPerPage`, message: `${label} needs at least one entry.` })
  }
  if (template.columns.length === 0) {
    issues.push({ path: `${label}.columns`, message: `${label} needs at least one column.` })
  }
  const ids = new Set<string>()
  template.columns.forEach((column, index) => {
    const columnLabel = `${label} column ${index + 1}`
    if (!column.id || ids.has(column.id)) {
      issues.push({
        path: `${label}.columns.${index}.id`,
        message: `${columnLabel} needs a unique id.`
      })
    }
    ids.add(column.id)
    if (!column.name.trim()) {
      issues.push({
        path: `${label}.columns.${index}.name`,
        message: `${columnLabel} needs a name.`
      })
    }
    if (![column.x, column.y, column.width, column.height, column.spacing].every(Number.isFinite)) {
      issues.push({
        path: `${label}.columns.${index}`,
        message: `${columnLabel} contains an invalid number.`
      })
      return
    }
    if (column.x < 0 || column.y < 0 || column.width <= 0 || column.height <= 0) {
      issues.push({
        path: `${label}.columns.${index}`,
        message: `${columnLabel} must have positive dimensions.`
      })
    }
    const exceedsRightEdge = column.x + column.width > dimensions.width
    const exceedsBottomEdge = column.y + column.height > dimensions.height
    if (exceedsRightEdge || exceedsBottomEdge) {
      const edges = [
        ...(exceedsRightEdge
          ? [`right edge (${column.x + column.width} > ${dimensions.width} pt)`]
          : []),
        ...(exceedsBottomEdge
          ? [`bottom edge (${column.y + column.height} > ${dimensions.height} pt)`]
          : [])
      ]
      issues.push({
        path: `${label}.columns.${index}`,
        message: `${columnLabel} must fit inside the page; it exceeds the ${edges.join(' and ')}. x/y are the top-left; height is the whole column.`
      })
    }
    if (column.spacing <= 0) {
      issues.push({
        path: `${label}.columns.${index}.spacing`,
        message: `${columnLabel} spacing must be positive.`
      })
    }
  })
  return issues
}

export function validateKeptExportTemplateDraft(
  draft: KeptExportTemplateDraft
): KeptExportTemplateValidationIssue[] {
  return [
    ...validateKeptExportPageTemplate(draft.pageOneTemplate, 'Page 1'),
    ...(draft.useSeparateLaterPages
      ? validateKeptExportPageTemplate(draft.laterPagesTemplate, 'Later pages')
      : [])
  ]
}

export function toKeptExportTemplate(
  draft: KeptExportTemplateDraft
): KeptExportTemplate & { summaryFields: KeptExportSummaryField[] } {
  return {
    useSeparateLaterPages: draft.useSeparateLaterPages,
    pageOneTemplate: cloneKeptExportPageTemplate(draft.pageOneTemplate),
    laterPagesTemplate: cloneKeptExportPageTemplate(draft.laterPagesTemplate),
    summaryFields: [...draft.summaryFields]
  }
}
