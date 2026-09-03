import type {
  KeptEntriesBackground,
  KeptEntriesFontRef,
  KeptEntriesOrientation,
  KeptEntriesPageSize
} from './keptEntriesLayout'

export type KeptExportLayoutMode = 'column-fill' | 'table-row'
export type KeptExportOverflowBehavior = 'wrap' | 'clip' | 'next-page'
export type KeptExportSourceField =
  | 'text'
  | 'payee'
  | 'date'
  | 'money-out'
  | 'money-in'
  | 'balance'
  | 'calculated-balance'
  | 'category'
  | 'reference'

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

export interface KeptExportDivider {
  enabled: boolean
  width: number
  thickness: number
  color: string
  opacity: number
  startX: number
  endX: number
}

export type KeptExportRunningBalanceFallback = 'first-existing-balance' | 'zero'
export type KeptExportBalanceFieldMode = 'keep-original' | 'replace-original' | 'add-calculated'

export interface KeptExportRunningBalance {
  enabled: boolean
  /** Blank means resolve the opening balance from `fallback`. */
  openingBalance?: number
  fallback: KeptExportRunningBalanceFallback
  balanceFieldMode: KeptExportBalanceFieldMode
  decimalPlaces: number
}

export const DEFAULT_KEPT_EXPORT_RUNNING_BALANCE: KeptExportRunningBalance = {
  enabled: false,
  fallback: 'first-existing-balance',
  balanceFieldMode: 'add-calculated',
  decimalPlaces: 2
}

export type KeptExportPageNumberAnchor =
  'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface KeptExportPageNumberFormat {
  /** Use {n} for the current page number and {total} for the page count. */
  template: string
  startAt: number
}

export interface KeptExportPageNumbers {
  enabled: boolean
  /** When true, position/format/style were filled in from the detected source page numbers. */
  matchSourceStyle: boolean
  anchor: KeptExportPageNumberAnchor
  offsetX: number
  offsetY: number
  format: KeptExportPageNumberFormat
  textStyle: KeptExportTextStyle
  scale: number
}

export const DEFAULT_KEPT_EXPORT_PAGE_NUMBERS: KeptExportPageNumbers = {
  enabled: false,
  matchSourceStyle: true,
  anchor: 'bottom-center',
  offsetX: 0,
  offsetY: 24,
  format: { template: '{n}', startAt: 1 },
  textStyle: {
    fontRef: { kind: 'standard-14', family: 'Helvetica' },
    fontSize: 9,
    color: '#657067',
    fontWeight: 'normal',
    fontStyle: 'normal'
  },
  scale: 1
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
  /** When enabled, rows begin at startY and continue until endY on each page. */
  fillBetweenY?: boolean
  startY?: number
  endY?: number
  showReferenceUnderMainText?: boolean
  defaultTextStyle: KeptExportTextStyle
  columns: KeptExportColumn[]
  divider?: KeptExportDivider
  background?: KeptEntriesBackground
}

export interface KeptExportTemplate {
  useSeparateLaterPages: boolean
  pageOneTemplate: KeptExportPageTemplate
  laterPagesTemplate: KeptExportPageTemplate
  summaryFields?: KeptExportSummaryField[]
  runningBalance?: KeptExportRunningBalance
  pageNumbers?: KeptExportPageNumbers
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
  dividers: KeptExportDividerPlacement[]
}

export interface KeptExportDividerPlacement {
  entryId: string
  pageNumber: number
  startX: number
  endX: number
  y: number
  thickness: number
  color: string
  opacity: number
}

export interface KeptExportLayoutWarning {
  code:
    | 'overflow'
    | 'missing-value'
    | 'no-columns'
    | 'running-balance-fallback'
    | 'running-balance-unmappable'
  entryId?: string
  columnId?: string
  message: string
}

export interface KeptExportRenderPlan {
  pages: KeptExportPage[]
  warnings: KeptExportLayoutWarning[]
}
