/**
 * One canonical length unit for the whole app: PDF points. Everything stored in a project,
 * a layout, a bbox, or an export is in points. Other units exist only for display and input,
 * so a value converted for the UI must be converted back before it is stored.
 */
export type LengthUnit = 'pt' | 'mm' | 'cm' | 'in' | 'px'

export const CANONICAL_LENGTH_UNIT = 'pt' satisfies LengthUnit

export const LENGTH_UNITS: readonly LengthUnit[] = ['pt', 'mm', 'cm', 'in', 'px']

export const LENGTH_UNIT_LABELS: Record<LengthUnit, string> = {
  pt: 'Points',
  mm: 'Millimetres',
  cm: 'Centimetres',
  in: 'Inches',
  px: 'Pixels'
}

/** 72 points per inch; CSS pixels are 96 per inch. */
const POINTS_PER_UNIT: Record<LengthUnit, number> = {
  pt: 1,
  mm: 72 / 25.4,
  cm: 720 / 25.4,
  in: 72,
  px: 0.75
}

/** Sensible input precision per unit: a tenth of a point is already sub-pixel. */
export const LENGTH_UNIT_PRECISION: Record<LengthUnit, number> = {
  pt: 1,
  mm: 1,
  cm: 2,
  in: 2,
  px: 1
}

export const LENGTH_UNIT_STEP: Record<LengthUnit, number> = {
  pt: 1,
  mm: 0.5,
  cm: 0.1,
  in: 0.05,
  px: 1
}

export function isLengthUnit(value: unknown): value is LengthUnit {
  return typeof value === 'string' && (LENGTH_UNITS as readonly string[]).includes(value)
}

export function toPoints(value: number, unit: LengthUnit): number {
  return value * POINTS_PER_UNIT[unit]
}

export function fromPoints(points: number, unit: LengthUnit): number {
  return points / POINTS_PER_UNIT[unit]
}

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  return fromPoints(toPoints(value, from), to)
}

export function roundForUnit(value: number, unit: LengthUnit): number {
  const factor = 10 ** LENGTH_UNIT_PRECISION[unit]
  return Math.round(value * factor) / factor
}

/** Display a canonical points value in the requested unit, without a unit suffix. */
export function formatLength(points: number, unit: LengthUnit): string {
  if (!Number.isFinite(points)) return ''
  return roundForUnit(fromPoints(points, unit), unit).toFixed(LENGTH_UNIT_PRECISION[unit])
}

export function formatLengthWithUnit(points: number, unit: LengthUnit): string {
  const formatted = formatLength(points, unit)
  return formatted === '' ? '' : `${formatted} ${unit}`
}

/**
 * Parses user input into canonical points. A unit suffix in the text wins over `unit`, so
 * typing "10mm" into a points field does what the user meant. Returns null for unusable input.
 */
export function parseLength(input: string, unit: LengthUnit): number | null {
  const match = /^\s*(-?\d*\.?\d+)\s*([a-z]*)\s*$/i.exec(input)
  if (!match) return null
  const value = Number.parseFloat(match[1])
  if (!Number.isFinite(value)) return null
  const suffix = match[2].toLowerCase()
  if (suffix.length > 0 && !isLengthUnit(suffix)) return null
  return toPoints(value, suffix.length > 0 ? (suffix as LengthUnit) : unit)
}

/**
 * Resolves what a field should commit: points, `null` when an optional field is cleared, or
 * `undefined` when the input is unusable and the previous value should be restored.
 */
export function resolveLengthCommit(
  text: string,
  options: { unit: LengthUnit; optional?: boolean; min?: number; max?: number }
): number | null | undefined {
  if (text.trim() === '') return options.optional ? null : undefined
  const points = parseLength(text, options.unit)
  if (points === null) return undefined
  return Math.min(
    options.max ?? Number.POSITIVE_INFINITY,
    Math.max(options.min ?? Number.NEGATIVE_INFINITY, points)
  )
}
