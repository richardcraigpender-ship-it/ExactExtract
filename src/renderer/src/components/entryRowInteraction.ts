const INTERACTIVE_ROW_SELECTOR =
  'button, input, textarea, select, a[href], label, summary, [role="button"], [role="tab"], [role="checkbox"], [data-interactive]'

export function hasNestedInteractiveTarget(
  target: unknown,
  currentTarget?: Element | null
): boolean {
  if (!target || typeof target !== 'object') return false
  const candidate = target as { closest?: (selector: string) => Element | null }
  if (typeof candidate.closest !== 'function') return false
  const interactive = candidate.closest(INTERACTIVE_ROW_SELECTOR)
  return Boolean(interactive && interactive !== currentTarget)
}
