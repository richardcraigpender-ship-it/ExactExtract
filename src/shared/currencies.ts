export const DEFAULT_CURRENCY_CODE = 'GBP' as const

export const POPULAR_CURRENCIES = [
  { code: 'GBP', symbol: '£', name: 'British pound' },
  { code: 'USD', symbol: '$', name: 'US dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian rupee' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand dollar' }
] as const

export type CurrencyCode = (typeof POPULAR_CURRENCIES)[number]['code']

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && POPULAR_CURRENCIES.some((currency) => currency.code === value)
}

export function resolveCurrencyCode(value: unknown): CurrencyCode {
  return isCurrencyCode(value) ? value : DEFAULT_CURRENCY_CODE
}

export function currencySymbol(code: CurrencyCode): string {
  return POPULAR_CURRENCIES.find((currency) => currency.code === code)?.symbol ?? code
}
