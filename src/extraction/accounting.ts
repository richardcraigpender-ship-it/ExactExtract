import { normalizeNumber } from '../analysis/normalize'

export interface AccountingLineDetails {
  category: string
  tags: string[]
  amountCount: number
  numericValue?: number
  date?: string
}

const DATE_PATTERN =
  /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?[/-]\d{1,2}[/-]\d{2,4})\b/g
const AMOUNT_PATTERN =
  /(?:[$€£¥₹]\s*)?\(?[+-]?(?:\d{1,3}(?:[,.\s]\d{3})+|\d+)(?:[.,]\d{1,2})?\)?(?:\s*(?:CR|DR))?/gi
const ACCOUNT_CODE_PATTERN = /^\s*([A-Za-z]{0,3}-?\d{3,10})\b(?=\s+[A-Za-z])/i

function normalizeDate(value: string): string | undefined {
  const monthDate = value.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\s+(\d{4})$/i)
  if (monthDate) {
    const month = new Date(`${monthDate[2]} 1, 2000`).getMonth() + 1
    const day = Number(monthDate[1])
    const year = Number(monthDate[3])
    const date = new Date(Date.UTC(year, month - 1, day))
    return Number.isNaN(date.valueOf()) || date.getUTCDate() !== day
      ? undefined
      : `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
          .toString()
          .padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isNaN(date.valueOf()) ? undefined : value
  }
  const [firstText, secondText, yearText] = value.split(/[/-]/)
  const first = Number(firstText)
  const second = Number(secondText)
  const year = Number(yearText?.length === 2 ? `20${yearText}` : yearText)
  const month = first > 12 ? second : first
  const day = first > 12 ? first : second
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) return undefined
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`
}

function extractAmounts(text: string, dateMatches: readonly RegExpMatchArray[]): number[] {
  const accountCode = text.match(ACCOUNT_CODE_PATTERN)?.[1]
  return [...text.matchAll(AMOUNT_PATTERN)].flatMap((match) => {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (
      dateMatches.some(
        (date) => start < (date.index ?? 0) + date[0].length && end > (date.index ?? 0)
      )
    ) {
      return []
    }
    if (accountCode && match[0].trim() === accountCode) return []
    const suffix = match[0].match(/\b(CR|DR)$/i)?.[1]?.toUpperCase()
    const numericText = match[0].replace(/\s*(?:CR|DR)$/i, '')
    const normalized = normalizeNumber(numericText)
    if (normalized.value === null) return []
    return [suffix === 'CR' ? -Math.abs(normalized.value) : normalized.value]
  })
}

export function extractAccountingLineDetails(
  text: string,
  accountingDocument = false
): AccountingLineDetails | null {
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  if (!normalizedText) return null
  const lower = normalizedText.toLocaleLowerCase()
  const explicitAccounting =
    /\b(debit|credit|balance|assets?|liabilit(?:y|ies)|equity|revenue|income|expenses?|subtotal|total|ledger|receivables?|payables?|cash flow)\b/.test(
      lower
    )
  const dateMatches = [...normalizedText.matchAll(DATE_PATTERN)]
  const amounts = extractAmounts(normalizedText, dateMatches)
  const strongStandaloneEvidence =
    /\b(trial balance|general ledger|balance sheet|income statement|profit and loss|cash flow|debit|credit)\b/.test(
      lower
    )
  if (
    !accountingDocument &&
    !strongStandaloneEvidence &&
    !(explicitAccounting && amounts.length > 0)
  ) {
    return null
  }

  const date = dateMatches.map((match) => normalizeDate(match[0])).find(Boolean)
  let category = 'accounting-entry'
  const tags = ['accounting']

  if (/\b(total|subtotal|net income|net loss)\b/.test(lower)) {
    category = 'accounting-total'
    tags.push('accounting:total')
  } else if (/\b(balance|assets?|liabilit(?:y|ies)|equity)\b/.test(lower)) {
    category = 'accounting-balance'
    tags.push('accounting:balance')
  } else if (/\b(expenses?|cost|purchase)\b/.test(lower)) {
    category = 'accounting-expense'
    tags.push('accounting:expense')
  } else if (/\b(revenue|income|sales?)\b/.test(lower)) {
    category = 'accounting-income'
    tags.push('accounting:income')
  }
  if (/\b(debit|dr)\b/.test(lower)) tags.push('accounting:debit')
  if (/\b(credit|cr)\b/.test(lower)) tags.push('accounting:credit')
  if (ACCOUNT_CODE_PATTERN.test(normalizedText)) tags.push('accounting:account-code')
  if (amounts.length > 1) tags.push('accounting:multi-amount')

  return {
    category,
    tags,
    amountCount: amounts.length,
    ...(amounts.length === 1 ? { numericValue: amounts[0] } : {}),
    ...(date ? { date } : {})
  }
}
