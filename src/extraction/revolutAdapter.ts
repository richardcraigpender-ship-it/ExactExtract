const DATE_PREFIX =
  /^(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?[/-]\d{1,2}[/-]\d{2,4})\s+/i
const CURRENCY_AMOUNT = /[$€£¥₹]\s*\(?[+-]?(?:\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.\d{1,2})?\)?/gi

export function isRevolutStatement(lines: readonly string[]): boolean {
  return lines.some(
    (line) =>
      /\bGBP Statement\b/i.test(line) ||
      /\bDate\s+Description\s+Money out\s+Money in\s+Balance\b/i.test(line)
  )
}

function amountValue(value: string): number {
  return Number(value.replace(/[^0-9.-]/g, ''))
}

export function adaptRevolutTransaction(
  text: string,
  previousBalance?: number
): string | undefined {
  const date = text.match(DATE_PREFIX)
  if (!date) return undefined
  const withoutDate = text.slice(date[0].length)
  const amounts = [...withoutDate.matchAll(CURRENCY_AMOUNT)]
  if (amounts.length !== 2) return undefined

  const firstAmount = amounts[0]!
  const secondAmount = amounts[1]!
  const description = withoutDate.slice(0, firstAmount.index).trim()
  if (!description) return undefined
  const isIncoming = /^(?:payment from|from)\b/i.test(description)
  const firstValue = amountValue(firstAmount[0])
  const balanceValue = amountValue(secondAmount[0])
  const balanceDelta = previousBalance === undefined ? Number.NaN : balanceValue - previousBalance
  const followsBalance = Math.abs(Math.abs(balanceDelta) - firstValue) <= 0.01
  const inferredIncoming = followsBalance ? balanceDelta > 0 : isIncoming
  const isOutgoing = !inferredIncoming

  const outgoing = isOutgoing ? firstAmount[0] : '£0.00'
  const incoming = inferredIncoming ? firstAmount[0] : '£0.00'
  return `${date[1]} ${description} ${outgoing} ${incoming} ${secondAmount[0]}`
}
