export {
  detectBrokenRowsAcrossPages,
  detectDuplicateEntries,
  detectReviewIssues
} from './heuristics'
export type { ReviewHeuristicOptions, ReviewIssue, ReviewIssueCode } from './heuristics'
export {
  findEntryDirectlyAbove,
  findPreferredSourceRegion,
  mergeReviewEntries,
  reconcileReviewSelection,
  splitReviewEntry
} from './operations'
export { copyKeptEntryReferencesToNotes, extractEntryReferences } from './references'
export type { CopyKeptReferencesResult } from './references'
