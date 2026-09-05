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
export {
  clearScannedReferenceNotes,
  copyKeptEntryReferencesToNotes,
  copySourceReferencesToKeptEntryNotes,
  extractEntryReferences,
  extractReferencesFromText
} from './references'
export type {
  ClearReferenceNotesResult,
  CopyKeptReferencesResult,
  SourceReferenceCandidate
} from './references'
