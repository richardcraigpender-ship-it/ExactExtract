export type ReviewFilterStatus = 'all' | 'keep' | 'exclude' | 'maybe'
export type ReviewFilterSource = 'all' | 'parser' | 'ocr' | 'merged'

export interface ReviewFilterOptions {
  query: string
  reviewStatus: ReviewFilterStatus
  reviewSource: ReviewFilterSource
  reviewCategory: string
  reviewIssueFilter: string
  issuesByEntry: Map<string, Array<{ code: string }>>
}

export function normalizeReviewQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function entryMatchesReviewQuery(
  entry: { normalizedText: string; tags: readonly string[]; category?: string },
  query: string
): boolean {
  if (query.length === 0) return true
  const searchable = [entry.normalizedText, ...entry.tags, entry.category ?? '']
    .join(' ')
    .toLocaleLowerCase()
  return searchable.includes(query)
}

export function filterReviewEntries<
  T extends {
    id: string
    status: 'keep' | 'exclude' | 'maybe'
    source: 'parser' | 'ocr' | 'merged'
    normalizedText: string
    tags: readonly string[]
    category?: string
  }
>(entries: readonly T[], options: ReviewFilterOptions): T[] {
  const query = normalizeReviewQuery(options.query)
  const chunkSize = 250
  const results: T[] = []

  for (let index = 0; index < entries.length; index += chunkSize) {
    const chunk = entries.slice(index, index + chunkSize)
    for (const entry of chunk) {
      const matchesStatus = options.reviewStatus === 'all' || entry.status === options.reviewStatus
      const matchesSource = options.reviewSource === 'all' || entry.source === options.reviewSource
      const matchesCategory =
        options.reviewCategory === 'all' || entry.category === options.reviewCategory
      const matchesIssue =
        options.reviewIssueFilter === 'all' ||
        options.issuesByEntry
          .get(entry.id)
          ?.some((issue) => issue.code === options.reviewIssueFilter)
      const matchesQuery = entryMatchesReviewQuery(entry, query)

      if (matchesStatus && matchesSource && matchesCategory && matchesIssue && matchesQuery) {
        results.push(entry)
      }
    }
  }

  return results
}
