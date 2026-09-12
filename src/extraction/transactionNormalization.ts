export interface NormalizedTransactionDescription {
  description: string
  direction?: 'in' | 'out'
}

const TRAILING_DIRECTION = /\s+(money\s+(?:in|out)|debit|credit|in|out)\s*$/i
const PAYMENT_DIRECTION = /^(?:payment|transfer)\s+(from|to)\b/i

/**
 * Normalizes display-only transaction descriptions. Raw extracted text remains unchanged by design.
 */
export function normalizeTransactionDescription(value: string): NormalizedTransactionDescription {
  const description = value.replace(TRAILING_DIRECTION, '').replace(/\s+/g, ' ').trim()
  const directionMatch = description.match(PAYMENT_DIRECTION)
  return {
    description,
    ...(directionMatch ? { direction: directionMatch[1]!.toLocaleLowerCase() === 'from' ? 'in' : 'out' } : {})
  }
}

export function shouldReplaceStalePayee(
  payee: string | undefined,
  normalizedDescription: string
): boolean {
  if (!payee?.trim()) return true
  const normalizedPayee = payee.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
  const normalizedText = normalizedDescription.toLocaleLowerCase()
  return !normalizedText.includes(normalizedPayee)
}
