import { useEffect, useRef, useState } from 'react'

export const REVIEW_FILTER_CHUNK_SIZE = 250

export async function filterInChunks<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
  chunkSize = REVIEW_FILTER_CHUNK_SIZE,
  signal?: AbortSignal
): Promise<T[]> {
  const matches: T[] = []
  const safeChunkSize = Math.max(1, Math.floor(chunkSize))

  for (let start = 0; start < items.length; start += safeChunkSize) {
    if (signal?.aborted) return []
    const end = Math.min(items.length, start + safeChunkSize)
    for (let index = start; index < end; index += 1) {
      const item = items[index]
      if (item !== undefined && predicate(item)) matches.push(item)
    }
    if (end < items.length) {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
    }
  }

  return matches
}

/**
 * Returns `current` when it already holds exactly the same items in the same order, so React
 * state updates become no-ops instead of publishing a new array identity each pass.
 */
export function preserveIdentityIfUnchanged<T>(current: T[], next: T[]): T[] {
  return current.length === next.length && current.every((item, index) => item === next[index])
    ? current
    : next
}

export function useIncrementalReviewFilter<T>(
  items: readonly T[],
  filterKey: string,
  predicate: (item: T) => boolean
): T[] {
  const [filteredItems, setFilteredItems] = useState<T[]>(() => items.filter(predicate))
  const predicateRef = useRef(predicate)
  // Kept in a ref, and updated in an effect rather than during render, so that changing the
  // predicate identity every render does not retrigger the filter effect below. This effect is
  // declared first, so it commits the latest predicate before the filter effect reads it.
  useEffect(() => {
    predicateRef.current = predicate
  }, [predicate])

  useEffect(() => {
    const controller = new AbortController()
    void filterInChunks(
      items,
      (item) => predicateRef.current(item),
      REVIEW_FILTER_CHUNK_SIZE,
      controller.signal
    ).then((matches) => {
      if (controller.signal.aborted) return
      // Preserve the existing array identity when the result is unchanged so consumers
      // depending on this value don't re-render (and re-trigger this effect) endlessly.
      setFilteredItems((current) => preserveIdentityIfUnchanged(current, matches))
    })
    return () => controller.abort()
  }, [filterKey, items])

  return filteredItems
}
