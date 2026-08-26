import { useEffect, useState } from 'react'

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

export function useIncrementalReviewFilter<T>(
  items: readonly T[],
  filterKey: string,
  predicate: (item: T) => boolean
): T[] {
  const [filteredItems, setFilteredItems] = useState<T[]>(() => items.filter(predicate))

  useEffect(() => {
    const controller = new AbortController()
    void filterInChunks(items, predicate, REVIEW_FILTER_CHUNK_SIZE, controller.signal).then(
      (matches) => {
        if (!controller.signal.aborted) setFilteredItems(matches)
      }
    )
    return () => controller.abort()
  }, [filterKey, items, predicate])

  return filteredItems
}
