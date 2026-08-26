import type { NormalizedNumber, NumericNormalizationOptions } from './types'

const CURRENCY_AND_SPACE = /[$€£¥₹₩₽₺₫฿₴₦₱₲₡₵₸₼₾\s\u00a0\u202f]/gu
const TRAILING_SIGN = /^(.*?)([+-])$/

function resolveDecimalSeparator(value: string): '.' | ',' | null {
  const lastDot = value.lastIndexOf('.')
  const lastComma = value.lastIndexOf(',')

  if (lastDot >= 0 && lastComma >= 0) return lastDot > lastComma ? '.' : ','

  const separator = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : null
  if (!separator) return null

  const occurrences = value.split(separator).length - 1
  const fractionalDigits = value.length - value.lastIndexOf(separator) - 1
  if (occurrences > 1) return fractionalDigits === 3 ? null : separator
  if (fractionalDigits === 3 && value.replace(/[^0-9]/g, '').length > 3) return null
  return separator
}

export function normalizeNumber(
  input: unknown,
  options: NumericNormalizationOptions = {}
): NormalizedNumber {
  if (typeof input === 'number') {
    return Number.isFinite(input)
      ? { value: input, isPercentage: false }
      : { value: null, isPercentage: false, error: 'non-finite' }
  }

  if (input === null || input === undefined) {
    return { value: null, isPercentage: false, error: 'empty' }
  }

  let text = String(input).trim()
  if (!text) return { value: null, isPercentage: false, error: 'empty' }

  const isPercentage = text.endsWith('%')
  const isParenthesized = /^\(.*\)$/.test(text)
  text = text
    .replace(/^\((.*)\)$/, '$1')
    .replace(/%$/, '')
    .replace(CURRENCY_AND_SPACE, '')
    .replace(/[−–—]/g, '-')

  const trailingSign = text.match(TRAILING_SIGN)
  if (trailingSign) text = `${trailingSign[2]}${trailingSign[1]}`

  const decimalSeparator =
    options.decimalSeparator === 'auto' || options.decimalSeparator === undefined
      ? resolveDecimalSeparator(text)
      : options.decimalSeparator

  if (decimalSeparator === ',') {
    text = text.replace(/\./g, '').replace(',', '.')
  } else if (decimalSeparator === '.') {
    text = text.replace(/,/g, '')
  } else {
    text = text.replace(/[.,]/g, '')
  }

  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text)) {
    return { value: null, isPercentage, error: 'invalid' }
  }

  let value = Number(text)
  if (!Number.isFinite(value)) return { value: null, isPercentage, error: 'non-finite' }
  if (isParenthesized) value = -Math.abs(value)
  if (isPercentage && options.percentageAsFraction !== false) value /= 100

  return { value, isPercentage }
}
