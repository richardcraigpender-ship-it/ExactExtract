import type {
  KeptEntriesBackground,
  KeptEntriesFontRef,
  KeptEntriesOrientation,
  KeptEntriesPageSize
} from './keptEntriesLayout'

export type KeptExportLayoutMode = 'column-fill' | 'table-row'
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

export interface KeptExportColumn {
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

export interface KeptExportPageTemplate {
  pageSize: KeptEntriesPageSize
  orientation: KeptEntriesOrientation
  layoutMode: KeptExportLayoutMode
  entriesPerPage: number
  defaultTextStyle: KeptExportTextStyle
  columns: KeptExportColumn[]
  background?: KeptEntriesBackground
}

export interface KeptExportTemplate {
  useSeparateLaterPages: boolean
  pageOneTemplate: KeptExportPageTemplate
  laterPagesTemplate: KeptExportPageTemplate
  summaryFields?: KeptExportSummaryField[]
}

export interface KeptExportSourceRow {
  entryId: string
  values: Partial<Record<KeptExportSourceField, string>>
}

export interface KeptExportPlacement {
  entryId: string
  columnId: string
  pageNumber: number
  text: string
  x: number
  y: number
  width: number
  height: number
  style: KeptExportTextStyle
}

export interface KeptExportPage {
  pageNumber: number
  template: KeptExportPageTemplate
  placements: KeptExportPlacement[]
}

export interface KeptExportLayoutWarning {
  code: 'overflow' | 'missing-value' | 'no-columns'
  entryId?: string
  columnId?: string
  message: string
}

export interface KeptExportRenderPlan {
  pages: KeptExportPage[]
  warnings: KeptExportLayoutWarning[]
}
