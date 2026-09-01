import { DEFAULT_CURRENCY_CODE, resolveCurrencyCode, type CurrencyCode } from './currencies'

export function formatCurrencyAmount(
  value: number,
  currencyCode: CurrencyCode = DEFAULT_CURRENCY_CODE,
  options: { decimalPlaces?: number } = {}
): string {
  const decimalPlaces = Math.max(0, Math.min(6, Math.trunc(options.decimalPlaces ?? 2)))
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: resolveCurrencyCode(currencyCode),
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  }).format(value)
}
