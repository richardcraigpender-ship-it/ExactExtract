import { useSyncExternalStore } from 'react'
import { CANONICAL_LENGTH_UNIT, isLengthUnit, type LengthUnit } from '../../../shared/units'

/**
 * The display unit is read by fields all over the tree and changed from one control, so it lives
 * in a tiny store rather than being threaded through every intermediate component. The value is
 * display-only: stored geometry is always PDF points.
 */
let currentUnit: LengthUnit = CANONICAL_LENGTH_UNIT
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getLengthUnit(): LengthUnit {
  return currentUnit
}

export function setLengthUnit(unit: LengthUnit): void {
  if (!isLengthUnit(unit) || unit === currentUnit) return
  currentUnit = unit
  for (const listener of listeners) listener()
}

export function useLengthUnit(): LengthUnit {
  return useSyncExternalStore(subscribe, getLengthUnit, getLengthUnit)
}
