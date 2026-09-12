import type { ProjectEntry, ProjectPage } from '../shared/contracts'

export type ReviewIssueCode = 'duplicate-entry' | 'broken-row-across-pages'

/**
 * 'info' notes something worth knowing but not necessarily wrong; 'warning' should be reviewed
 * before export; 'critical' means the extraction is very likely wrong and blocks confidence.
 */
export type ReviewIssueSeverity = 'info' | 'warning' | 'critical'

export interface ReviewIssue {
  id: string
  code: ReviewIssueCode
  severity: ReviewIssueSeverity
  entryIds: string[]
  documentId: string
  pageNumbers: number[]
  evidence: string
}

export interface ReviewHeuristicOptions {
  pages?: readonly ProjectPage[]
  expectedRowHeight?: number
}

function canonicalText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function firstRegion(entry: ProjectEntry): ProjectEntry['regions'][number] | undefined {
  return entry.regions[0]
}

export function detectDuplicateEntries(entries: readonly ProjectEntry[]): ReviewIssue[] {
  const groups = new Map<string, ProjectEntry[]>()
  for (const entry of entries) {
    const text = canonicalText(entry.normalizedText)
    if (text.length < 3) continue
    const region = firstRegion(entry)
    if (!region) continue
    const key = `${region.documentId}\u0000${text}`
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => {
      const sorted = [...group].sort((left, right) => left.id.localeCompare(right.id))
      const region = firstRegion(sorted[0])!
      const pageNumbers = [
        ...new Set(sorted.flatMap((entry) => entry.regions.map((item) => item.pageNumber)))
      ].sort((left, right) => left - right)
      return {
        id: `duplicate:${key.split('\u0000')[0]}:${sorted.map((entry) => entry.id).join('|')}`,
        code: 'duplicate-entry' as const,
        severity: 'warning' as const,
        entryIds: sorted.map((entry) => entry.id),
        documentId: region.documentId,
        pageNumbers,
        evidence: `Repeated normalized text: ${sorted[0]?.normalizedText.trim()}`
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id))
}

function looksIncomplete(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.length > 0 && !/[.!?;:]$/.test(trimmed)
}

function looksLikeContinuation(text: string): boolean {
  const trimmed = text.trim()
  return /^[a-z(,]|^[-+]?\d/.test(trimmed)
}

export function detectBrokenRowsAcrossPages(
  entries: readonly ProjectEntry[],
  options: ReviewHeuristicOptions = {}
): ReviewIssue[] {
  const expectedRowHeight = options.expectedRowHeight ?? 18
  const pageDimensions = new Map(
    (options.pages ?? []).map((page) => [`${page.documentId}:${page.pageNumber}`, page])
  )
  const located = entries
    .map((entry) => ({ entry, region: firstRegion(entry) }))
    .filter((item): item is { entry: ProjectEntry; region: NonNullable<typeof item.region> } =>
      Boolean(item.region)
    )
    .sort(
      (left, right) =>
        left.region.documentId.localeCompare(right.region.documentId) ||
        left.region.pageNumber - right.region.pageNumber ||
        (right.region.bbox?.y ?? 0) - (left.region.bbox?.y ?? 0) ||
        left.entry.id.localeCompare(right.entry.id)
    )

  const issues: ReviewIssue[] = []
  const processed = new Set<string>()
  for (const previous of located) {
    const previousPage = pageDimensions.get(
      `${previous.region.documentId}:${previous.region.pageNumber}`
    )
    const previousNearBottom =
      !previousPage ||
      (previous.region.bbox?.y ?? Number.POSITIVE_INFINITY) <= expectedRowHeight * 1.5
    if (!previousNearBottom) continue
    const nextCandidates = located.filter(
      (candidate) =>
        candidate.region.documentId === previous.region.documentId &&
        candidate.region.pageNumber === previous.region.pageNumber + 1
    )
    const next = nextCandidates
      .filter((candidate) => {
        const nextPage = pageDimensions.get(
          `${candidate.region.documentId}:${candidate.region.pageNumber}`
        )
        if (!nextPage) return true
        const topGap =
          nextPage.height - ((candidate.region.bbox?.y ?? 0) + (candidate.region.bbox?.height ?? 0))
        return topGap <= expectedRowHeight * 1.5
      })
      .sort((left, right) => (right.region.bbox?.y ?? 0) - (left.region.bbox?.y ?? 0))[0]
    if (!next || !looksIncomplete(previous.entry.normalizedText)) continue
    const tableEvidence =
      previous.entry.tags.includes('table-row') && next.entry.tags.includes('table-row')
    const nextPage = pageDimensions.get(`${next.region.documentId}:${next.region.pageNumber}`)
    const nextTopGap = nextPage
      ? nextPage.height - ((next.region.bbox?.y ?? 0) + (next.region.bbox?.height ?? 0))
      : Number.POSITIVE_INFINITY
    const geometryEvidence =
      Boolean(previousPage && nextPage) &&
      (previous.region.bbox?.y ?? Number.POSITIVE_INFINITY) <= expectedRowHeight * 1.5 &&
      nextTopGap <= expectedRowHeight * 1.5
    if (!tableEvidence && !geometryEvidence && !looksLikeContinuation(next.entry.normalizedText)) {
      continue
    }

    const issueId = `broken-row:${previous.entry.id}|${next.entry.id}`
    if (processed.has(issueId)) continue
    processed.add(issueId)
    issues.push({
      id: issueId,
      code: 'broken-row-across-pages',
      severity: 'warning',
      entryIds: [previous.entry.id, next.entry.id],
      documentId: previous.region.documentId,
      pageNumbers: [previous.region.pageNumber, next.region.pageNumber],
      evidence: tableEvidence
        ? 'Adjacent table rows may continue across a page boundary.'
        : 'Unterminated text may continue on the next page.'
    })
  }
  return issues.sort((left, right) => left.id.localeCompare(right.id))
}

export function detectReviewIssues(
  entries: readonly ProjectEntry[],
  options: ReviewHeuristicOptions = {}
): ReviewIssue[] {
  return [
    ...detectDuplicateEntries(entries),
    ...detectBrokenRowsAcrossPages(entries, options)
  ].sort((left, right) => left.id.localeCompare(right.id))
}
