import type { MerchantRecord } from '../shared/merchants'
import type { EntryDirection, ProjectEntry, ReviewStatus } from '../shared/contracts'

export type ForecastCadence = 'weekly' | 'fortnightly' | 'monthly'

export interface ForecastAssumptions {
  merchantIds: string[]
  startDate: string
  endDate: string
  cadence: ForecastCadence
  amount?: number
  /** When set, creates exactly this many seeded random rows across the timeframe. */
  randomRowCount?: number
  minSpend?: number
  maxSpend?: number
  direction?: EntryDirection
  variabilityPercent?: number
  seed: number
  includeExcluded?: boolean
}

export interface ForecastRow extends ProjectEntry {
  origin: 'scenario'
  merchantId: string
  scenarioSeed: number
}

export interface ForecastMonth {
  month: string
  total: number
  count: number
}

export interface ForecastResult {
  seed: number
  assumptions: ForecastAssumptions
  rows: ForecastRow[]
  total: number
  monthly: ForecastMonth[]
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid ISO date.`)
  return date
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function nextDate(date: Date, cadence: ForecastCadence): Date {
  const next = new Date(date)
  if (cadence === 'weekly') next.setUTCDate(next.getUTCDate() + 7)
  else if (cadence === 'fortnightly') next.setUTCDate(next.getUTCDate() + 14)
  else next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}

function seededRandom(seed: number): () => number {
  let state = Math.floor(seed) >>> 0 || 1
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 4294967296
  }
}

function rowId(seed: number, index: number): string {
  return `scenario-${(seed >>> 0).toString(16)}-${index.toString(36)}`
}

function selectedMerchants(
  merchants: readonly MerchantRecord[],
  assumptions: ForecastAssumptions
): MerchantRecord[] {
  const selected = new Set(assumptions.merchantIds)
  return merchants
    .filter(
      (merchant) =>
        selected.has(merchant.id) &&
        (merchant.classification === 'merchant-candidate' ||
          assumptions.includeExcluded === true) &&
        (merchant.forecastIncluded || assumptions.includeExcluded === true)
    )
    .sort((left, right) => left.id.localeCompare(right.id))
}

export function createMerchantTemplateRow(
  id: string,
  merchant: Pick<MerchantRecord, 'id' | 'canonicalDisplayName' | 'category' | 'defaultAmount'>,
  values: {
    date: string
    amount: number
    direction: EntryDirection
    notes?: string
    status?: ReviewStatus
  }
): ProjectEntry {
  const timestamp = new Date().toISOString()
  return {
    id,
    rawText: merchant.canonicalDisplayName,
    normalizedText: merchant.canonicalDisplayName,
    payee: merchant.canonicalDisplayName,
    source: 'merged',
    status: values.status ?? 'maybe',
    confidence: 1,
    regions: [],
    category: merchant.category,
    numericValue: roundCurrency(values.amount),
    date: values.date,
    notes: values.notes,
    tags: ['manual'],
    createdAt: timestamp,
    updatedAt: timestamp,
    origin: 'manual',
    merchantId: merchant.id,
    direction: values.direction
  }
}

export function generateForecast(
  merchants: readonly MerchantRecord[],
  assumptions: ForecastAssumptions
): ForecastResult {
  if (!Number.isInteger(assumptions.seed)) throw new Error('Forecast seed must be an integer.')
  const start = parseDate(assumptions.startDate, 'Forecast startDate')
  const end = parseDate(assumptions.endDate, 'Forecast endDate')
  if (start > end) throw new Error('Forecast startDate must not be after endDate.')
  const randomRowCount = assumptions.randomRowCount ?? 0
  if (!Number.isInteger(randomRowCount) || randomRowCount < 0) {
    throw new Error('Forecast randomRowCount must be a non-negative integer.')
  }
  const minSpend = assumptions.minSpend ?? assumptions.amount ?? 0
  const maxSpend = assumptions.maxSpend ?? assumptions.amount ?? minSpend
  if (!Number.isFinite(minSpend) || minSpend < 0) {
    throw new Error('Forecast minSpend must be a finite non-negative number.')
  }
  if (!Number.isFinite(maxSpend) || maxSpend < minSpend) {
    throw new Error('Forecast maxSpend must be finite and at least minSpend.')
  }
  if (
    assumptions.amount !== undefined &&
    (!Number.isFinite(assumptions.amount) || assumptions.amount < 0)
  ) {
    throw new Error('Forecast amount must be a finite non-negative number.')
  }
  const variability = assumptions.variabilityPercent ?? 0
  if (!Number.isFinite(variability) || variability < 0 || variability > 100) {
    throw new Error('Forecast variabilityPercent must be between 0 and 100.')
  }
  const chosen = selectedMerchants(merchants, assumptions)
  const random = seededRandom(assumptions.seed)
  const rows: ForecastRow[] = []
  let occurrence = 0
  const direction = assumptions.direction ?? 'out'
  if (randomRowCount > 0) {
    if (chosen.length === 0) throw new Error('At least one forecast-enabled merchant is required.')
    const startTime = start.getTime()
    const dateSpan = end.getTime() - startTime
    for (let index = 0; index < randomRowCount; index += 1) {
      const merchant = chosen[Math.floor(random() * chosen.length)] ?? chosen[0]
      const date = new Date(startTime + Math.floor(random() * (dateSpan + 1)))
      const amount = roundCurrency(minSpend + random() * (maxSpend - minSpend))
      const generatedAt = `${dateKey(date)}T00:00:00.000Z`
      rows.push({
        ...createMerchantTemplateRow(rowId(assumptions.seed, occurrence), merchant, {
          date: dateKey(date),
          amount,
          direction,
          notes: `Generated random forecast (seed ${assumptions.seed})`,
          status: 'maybe'
        }),
        origin: 'scenario',
        merchantId: merchant.id,
        createdAt: generatedAt,
        updatedAt: generatedAt,
        scenarioSeed: assumptions.seed
      })
      occurrence += 1
    }
  }
  for (const merchant of chosen) {
    if (randomRowCount > 0) break
    const amount = assumptions.amount ?? merchant.defaultAmount
    if (amount === undefined) continue
    for (let date = new Date(start); date <= end; date = nextDate(date, assumptions.cadence)) {
      const factor = variability === 0 ? 1 : 1 + ((random() * 2 - 1) * variability) / 100
      const value = roundCurrency(amount * factor)
      const generatedAt = `${dateKey(date)}T00:00:00.000Z`
      const row: ForecastRow = {
        ...createMerchantTemplateRow(rowId(assumptions.seed, occurrence), merchant, {
          date: dateKey(date),
          amount: value,
          direction,
          notes: `Generated forecast (${assumptions.cadence}, seed ${assumptions.seed})`,
          status: 'maybe'
        }),
        origin: 'scenario',
        merchantId: merchant.id,
        createdAt: generatedAt,
        updatedAt: generatedAt,
        scenarioSeed: assumptions.seed
      }
      rows.push(row)
      occurrence += 1
    }
  }
  const monthlyMap = new Map<string, ForecastMonth>()
  for (const row of rows) {
    const key = (row.date ?? '').slice(0, 7)
    const current = monthlyMap.get(key) ?? { month: key, total: 0, count: 0 }
    current.total = roundCurrency(current.total + (row.numericValue ?? 0))
    current.count += 1
    monthlyMap.set(key, current)
  }
  return {
    seed: assumptions.seed,
    assumptions: { ...assumptions, merchantIds: [...assumptions.merchantIds] },
    rows,
    total: roundCurrency(rows.reduce((sum, row) => sum + (row.numericValue ?? 0), 0)),
    monthly: [...monthlyMap.values()].sort((left, right) => left.month.localeCompare(right.month))
  }
}
