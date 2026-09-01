import type {
  KeptExportLayoutWarning,
  KeptExportRunningBalance
} from '../shared/keptExportTemplate'

export interface RunningBalanceInputRow {
  entryId: string
  moneyIn?: number
  moneyOut?: number
  balance?: number
  /** False when the row carried no mappable financial values. */
  financiallyMapped?: boolean
}

export interface RunningBalanceResult {
  values: Map<string, number>
  openingBalance: number
  openingBalanceSource: 'manual' | 'first-existing-balance' | 'zero'
  warnings: KeptExportLayoutWarning[]
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function amount(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function resolveOpeningBalance(
  rows: readonly RunningBalanceInputRow[],
  options: KeptExportRunningBalance
): Pick<RunningBalanceResult, 'openingBalance' | 'openingBalanceSource'> & {
  warning?: KeptExportLayoutWarning
} {
  if (typeof options.openingBalance === 'number' && Number.isFinite(options.openingBalance)) {
    return { openingBalance: money(options.openingBalance), openingBalanceSource: 'manual' }
  }

  if (options.fallback === 'first-existing-balance') {
    const first = rows.find(
      (row) => typeof row.balance === 'number' && Number.isFinite(row.balance)
    )
    if (first) {
      // Rewind the first detected balance by its own movement to recover the true opening figure.
      const inferred = money(amount(first.balance) - amount(first.moneyIn) + amount(first.moneyOut))
      return {
        openingBalance: inferred,
        openingBalanceSource: 'first-existing-balance',
        warning: {
          code: 'running-balance-fallback',
          entryId: first.entryId,
          message: `Opening balance inferred as ${inferred.toFixed(2)} from the first detected balance.`
        }
      }
    }
    return {
      openingBalance: 0,
      openingBalanceSource: 'zero',
      warning: {
        code: 'running-balance-fallback',
        message: 'No detected balance was available, so the opening balance defaults to 0.'
      }
    }
  }

  return { openingBalance: 0, openingBalanceSource: 'zero' }
}

export function buildRunningBalanceValues(
  rows: readonly RunningBalanceInputRow[],
  options: KeptExportRunningBalance
): RunningBalanceResult {
  const warnings: KeptExportLayoutWarning[] = []
  const values = new Map<string, number>()

  const opening = resolveOpeningBalance(rows, options)
  if (opening.warning) warnings.push(opening.warning)

  if (
    rows.length > 0 &&
    rows.every(
      (row) => row.moneyIn === undefined && row.moneyOut === undefined && row.balance === undefined
    )
  ) {
    warnings.push({
      code: 'running-balance-unmappable',
      message:
        'No kept rows had mappable money columns, so every calculated balance is the opening balance.'
    })
  }

  let previous = opening.openingBalance
  for (const row of rows) {
    previous = money(previous + amount(row.moneyIn) - amount(row.moneyOut))
    values.set(row.entryId, previous)
  }

  return {
    values,
    openingBalance: opening.openingBalance,
    openingBalanceSource: opening.openingBalanceSource,
    warnings
  }
}
