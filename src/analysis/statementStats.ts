import type { ProjectEntry } from '../shared/contracts'
import {
  mapFinancialEntry,
  type FinancialColumnMapping,
  type MappedFinancialRow
} from './reconcile'

export type StatementDataset = 'all' | 'kept'

export interface MonthlyStatementStats {
  key: string
  label: string
  rowCount: number
  moneyIn: number
  moneyOut: number
  netMovement: number
  openingBalance: number | null
  closingBalance: number | null
  balanceTotal: number
  contributorEntryIds: string[]
}

export interface StatementStats {
  dataset: StatementDataset
  rows: MappedFinancialRow[]
  sourceRowCount: number
  invalidRowCount: number
  moneyIn: number
  moneyOut: number
  netMovement: number
  balanceTotal: number
  openingBalance: number | null
  closingBalance: number | null
  calculatedClosingBalance: number | null
  difference: number | null
  reconciled: boolean
  months: MonthlyStatementStats[]
  contributorEntryIds: string[]
  unmappedEntryIds: string[]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function dateValue(row: MappedFinancialRow): number {
  const value = row.date ? Date.parse(row.date) : Number.NaN
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value
}

function monthKey(row: MappedFinancialRow): string {
  const value = row.date ? new Date(row.date) : undefined
  return value && !Number.isNaN(value.valueOf())
    ? `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`
    : 'undated'
}

function monthLabel(key: string): string {
  if (key === 'undated') return 'Undated'
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function calculateStatementStats(
  entries: readonly ProjectEntry[],
  mapping: FinancialColumnMapping,
  dataset: StatementDataset
): StatementStats {
  const sourceEntries =
    dataset === 'kept' ? entries.filter((entry) => entry.status === 'keep') : entries
  const rows: MappedFinancialRow[] = []
  const unmappedEntryIds: string[] = []
  for (const entry of sourceEntries) {
    const row = mapFinancialEntry(entry, mapping)
    if (row) rows.push(row)
    else unmappedEntryIds.push(entry.id)
  }
  const orderedRows = [...rows].sort((left, right) => dateValue(left) - dateValue(right))
  const balancedRows = orderedRows.filter((row) => row.balance !== undefined)
  const firstBalancedRow = balancedRows[0]
  const openingBalance =
    firstBalancedRow === undefined
      ? null
      : roundMoney(firstBalancedRow.balance! + firstBalancedRow.moneyOut - firstBalancedRow.moneyIn)
  const closingBalance = balancedRows.at(-1)?.balance ?? null
  const moneyIn = roundMoney(rows.reduce((total, row) => total + row.moneyIn, 0))
  const moneyOut = roundMoney(rows.reduce((total, row) => total + row.moneyOut, 0))
  const netMovement = roundMoney(moneyIn - moneyOut)
  const balanceTotal = roundMoney(
    balancedRows.reduce((total, row) => total + (row.balance ?? 0), 0)
  )
  const calculatedClosingBalance =
    openingBalance === null ? null : roundMoney(openingBalance + netMovement)
  const difference =
    calculatedClosingBalance === null || closingBalance === null
      ? null
      : roundMoney(calculatedClosingBalance - closingBalance)
  const monthMap = new Map<string, MonthlyStatementStats>()
  for (const row of orderedRows) {
    const key = monthKey(row)
    const month = monthMap.get(key) ?? {
      key,
      label: monthLabel(key),
      rowCount: 0,
      moneyIn: 0,
      moneyOut: 0,
      netMovement: 0,
      openingBalance: null,
      closingBalance: null,
      balanceTotal: 0,
      contributorEntryIds: []
    }
    month.rowCount += 1
    month.contributorEntryIds.push(row.entryId)
    month.moneyIn = roundMoney(month.moneyIn + row.moneyIn)
    month.moneyOut = roundMoney(month.moneyOut + row.moneyOut)
    month.netMovement = roundMoney(month.moneyIn - month.moneyOut)
    if (row.balance !== undefined) {
      month.openingBalance ??= row.balance
      month.closingBalance = row.balance
      month.balanceTotal = roundMoney(month.balanceTotal + row.balance)
    }
    monthMap.set(key, month)
  }
  return {
    dataset,
    rows: orderedRows,
    sourceRowCount: sourceEntries.length,
    invalidRowCount: sourceEntries.length - rows.length,
    moneyIn,
    moneyOut,
    netMovement,
    balanceTotal,
    openingBalance,
    closingBalance,
    calculatedClosingBalance,
    difference,
    reconciled: difference !== null && Math.abs(difference) <= 0.01,
    months: [...monthMap.values()].sort((left, right) => left.key.localeCompare(right.key)),
    contributorEntryIds: orderedRows.map((row) => row.entryId),
    unmappedEntryIds
  }
}
