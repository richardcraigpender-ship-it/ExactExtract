const LEAD_IN = 'Entry images could not be generated'
const GUIDANCE = 'Placed images stay listed as placeholders and text layout is unaffected.'

/**
 * Builds the canvas warning from a resolver failure. The reason may be a raw `Error.message`, which
 * rarely ends in punctuation, and may already open with the lead-in, so neither is assumed.
 */
export function describeImageResolutionFailure(reason: string | undefined): string | undefined {
  const trimmed = reason?.trim()
  if (!trimmed) return undefined
  const body = trimmed.toLowerCase().startsWith(LEAD_IN.toLowerCase())
    ? trimmed
    : `${LEAD_IN}: ${trimmed}`
  const terminated = /[.!?]$/.test(body) ? body : `${body}.`
  return `${terminated} ${GUIDANCE}`
}
