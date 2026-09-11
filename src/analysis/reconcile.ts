import type { ProjectEntry } from '../shared/contracts'
import { normalizeNumber } from './normalize'

export type AmountColumnRole = 'money-out' | 'money-in' | 'balance' | 'ignore'
export type DateColumnSource = 'detected-date' | 'entry-date' | 'ignore'
export type DescriptionColumnSource =
  'detected-description' | 'normalized-text' | 'raw-text' | 'ignore'
export type ReferenceColumnSource = 'entry-notes' | 'ignore'
export type CategoryColumnSource = 'entry-category' | 'ignore'

export interface FinancialColumnMapping {
  amountColumns: AmountColumnRole[]
  dateSource: DateColumnSource
  descriptionSource: DescriptionColumnSource
  referenceSource: ReferenceColumnSource
  categorySource: CategoryColumnSource
}

export interface MappedFinancialRow {
  entryId: string
  date?: string
  payee?: string
  description: string
  reference?: string
  category?: string
  moneyOut: number
  moneyIn: number
  balance?: number
}

export interface ReconciliationResult {
  rows: MappedFinancialRow[]
  openingBalance: number | null
  closingBalance: number | null
  calculatedClosingBalance: number | null
  difference: number | null
  reconciled: boolean
}

const DATE_PREFIX =
  /^(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?[/-]\d{1,2}[/-]\d{2,4})\s+/
const AMOUNT =
  /(?:[$€£¥₹]\s*)?\(?[+-]?(?:\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.\d{1,2})?\)?(?:\s*(?:CR|DR))?/gi
const CURRENCY_AMOUNT =
  /(?:[$€£¥₹]\s*)\(?[+-]?(?:\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.\d{1,2})?\)?(?:\s*(?:CR|DR))?/gi
const TRAILING_DIRECTION_WORDS = /\s+(?:money\s+(?:in|out)|debit|credit|in|out)\s*$/i
const INCOMPLETE_TRANSACTION_DESCRIPTION =
  /^(?:payment\s+(?:from|to)|transfer\s+(?:from|to)|from|to)$/i
const REFERENCE_DETAIL_LINE =
  /\b(?:ref(?:erence)?|card|invoice|inv|order|po|receipt|transaction|txn|id)\b/i

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function amountValue(value: string): number | null {
  const suffix = value.match(/\b(CR|DR)$/i)?.[1]?.toUpperCase()
  const normalized = normalizeNumber(value.replace(/\s*(?:CR|DR)$/i, '')).value
  if (normalized === null) return null
  return suffix === 'DR' ? -Math.abs(normalized) : normalized
}

function inferTransactionAmountRole(description: string): AmountColumnRole | undefined {
  const normalized = description.replace(TRAILING_DIRECTION_WORDS, '')
  if (/^(?:payment from|transfer from|top-up by|from)\b/i.test(normalized)) return 'money-in'
  if (/^(?:to|payment to|plus|fee|cash withdrawal)\b/i.test(normalized)) return 'money-out'
  return undefined
}

function normalizeDetectedDescription(value: string): string {
  return value.replace(TRAILING_DIRECTION_WORDS, '').trim()
}

function splitEntryNoteContinuations(notes?: string): {
  descriptionLines: string[]
  reference: string
} {
  const lines = (notes ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const descriptionLines: string[] = []
  let referenceStart = lines.length

  for (const [index, line] of lines.entries()) {
    if (REFERENCE_DETAIL_LINE.test(line)) {
      referenceStart = index
      break
    }
    descriptionLines.push(line)
  }

  return { descriptionLines, reference: lines.slice(referenceStart).join('\n') }
}

function completeDescription(
  value: string,
  notes?: string
): { description: string; reference: string } {
  const description = normalizeDetectedDescription(value)
  const continuations = splitEntryNoteContinuations(notes)
  if (
    !INCOMPLETE_TRANSACTION_DESCRIPTION.test(description) ||
    continuations.descriptionLines.length === 0
  ) {
    return { description, reference: notes?.trim() ?? '' }
  }
  return {
    description: `${description} ${continuations.descriptionLines.join(' ')}`,
    reference: continuations.reference
  }
}

export function mapFinancialEntry(
  entry: ProjectEntry,
  mapping: FinancialColumnMapping
): MappedFinancialRow | null {
  const dateMatch = entry.normalizedText.match(DATE_PREFIX)
  const withoutDate = dateMatch
    ? entry.normalizedText.slice(dateMatch[0].length)
    : entry.normalizedText
  const hasCurrencyAmount = CURRENCY_AMOUNT.test(withoutDate)
  CURRENCY_AMOUNT.lastIndex = 0
  const matches = [
    ...(hasCurrencyAmount ? withoutDate.matchAll(CURRENCY_AMOUNT) : withoutDate.matchAll(AMOUNT))
  ]
  if (
    !dateMatch &&
    !/\b(balance|total|subtotal|debit|credit|revenue|income|expense)\b/i.test(entry.normalizedText)
  ) {
    return null
  }
  if (matches.length === 0) return null
  const values = matches.map((match) => amountValue(match[0]))
  const firstAmountIndex = matches[0]?.index ?? withoutDate.length
  const completedDescription = completeDescription(
    withoutDate.slice(0, firstAmountIndex),
    entry.notes
  )
  const detectedDescription = completedDescription.description
  const detectedPayee = entry.payee
    ? completeDescription(entry.payee, entry.notes).description
    : detectedDescription
  const inferredRole = inferTransactionAmountRole(detectedDescription)
  const date =
    mapping.dateSource === 'entry-date'
      ? entry.date
      : mapping.dateSource === 'detected-date'
        ? dateMatch?.[1]
        : undefined
  const description =
    mapping.descriptionSource === 'normalized-text'
      ? entry.normalizedText
      : mapping.descriptionSource === 'raw-text'
        ? entry.rawText
        : mapping.descriptionSource === 'detected-description'
          ? detectedDescription
          : ''
  const row: MappedFinancialRow = {
    entryId: entry.id,
    ...(date ? { date } : {}),
    ...(detectedPayee ? { payee: detectedPayee } : {}),
    description,
    ...(mapping.referenceSource === 'entry-notes' && completedDescription.reference
      ? { reference: completedDescription.reference }
      : {}),
    ...(mapping.categorySource === 'entry-category' && entry.category
      ? { category: entry.category }
      : {}),
    moneyOut: 0,
    moneyIn: 0
  }
  values.forEach((value, index) => {
    if (value === null) return
    const role =
      index === 0 && inferredRole ? inferredRole : (mapping.amountColumns[index] ?? 'ignore')
    if (role === 'money-out') row.moneyOut += Math.abs(value)
    else if (role === 'money-in') row.moneyIn += Math.abs(value)
    else if (role === 'balance') row.balance = value
  })
  return row
}

export function reconcileFinancialEntries(
  entries: readonly ProjectEntry[],
  mapping: FinancialColumnMapping,
  tolerance = 0.01
): ReconciliationResult {
  const rows = entries
    .filter((entry) => entry.status === 'keep')
    .map((entry) => mapFinancialEntry(entry, mapping))
    .filter((row): row is MappedFinancialRow => row !== null)
  const balancedRows = rows.filter((row) => row.balance !== undefined)
  if (balancedRows.length === 0) {
    return {
      rows,
      openingBalance: null,
      closingBalance: null,
      calculatedClosingBalance: null,
      difference: null,
      reconciled: false
    }
  }
  const first = balancedRows[0]!
  const last = balancedRows.at(-1)!
  const openingBalance = money(first.balance! + first.moneyOut - first.moneyIn)
  const calculatedClosingBalance = money(
    openingBalance + rows.reduce((total, row) => total + row.moneyIn - row.moneyOut, 0)
  )
  const difference = money(calculatedClosingBalance - last.balance!)
  return {
    rows,
    openingBalance,
    closingBalance: last.balance!,
    calculatedClosingBalance,
    difference,
    reconciled: Math.abs(difference) <= tolerance
  }
}
