export function navigateToAnalysisIssue(
  entryIds: readonly string[],
  onNavigateToEntry?: (entryId: string) => void
): void {
  const entryId = entryIds[0]
  if (entryId) onNavigateToEntry?.(entryId)
}
