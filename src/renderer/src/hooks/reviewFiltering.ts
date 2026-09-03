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

export interface ReviewFilterableEntry {
  id: string
  status: 'keep' | 'exclude' | 'maybe'
  source: 'parser' | 'ocr' | 'merged'
  normalizedText: string
  tags: readonly string[]
  category?: string
}

export function normalizeReviewQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function hasActiveReviewFilters(
  options: Pick<
    ReviewFilterOptions,
    'query' | 'reviewStatus' | 'reviewSource' | 'reviewCategory' | 'reviewIssueFilter'
  >
): boolean {
  return (
    normalizeReviewQuery(options.query).length > 0 ||
    options.reviewStatus !== 'all' ||
    options.reviewSource !== 'all' ||
    options.reviewCategory !== 'all' ||
    options.reviewIssueFilter !== 'all'
  )
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

export function entryMatchesReviewFilters<T extends ReviewFilterableEntry>(
  entry: T,
  options: ReviewFilterOptions,
  query = normalizeReviewQuery(options.query)
): boolean {
  const matchesStatus = options.reviewStatus === 'all' || entry.status === options.reviewStatus
  const matchesSource = options.reviewSource === 'all' || entry.source === options.reviewSource
  const matchesCategory =
    options.reviewCategory === 'all' || entry.category === options.reviewCategory
  const matchesIssue =
    options.reviewIssueFilter === 'all' ||
    options.issuesByEntry.get(entry.id)?.some((issue) => issue.code === options.reviewIssueFilter)
  const matchesQuery = entryMatchesReviewQuery(entry, query)

  return Boolean(matchesStatus && matchesSource && matchesCategory && matchesIssue && matchesQuery)
}

export function filterReviewEntries<T extends ReviewFilterableEntry>(
  entries: readonly T[],
  options: ReviewFilterOptions
): T[] {
  if (!hasActiveReviewFilters(options)) return entries as T[]
  const query = normalizeReviewQuery(options.query)

  return entries.filter((entry) => entryMatchesReviewFilters(entry, options, query))
}
