import type { RecentProject } from '../shared/contracts'

export type RecentProjectAvailability = 'available' | 'missing' | 'unknown'

export interface RecentProjectRecoveryItem extends RecentProject {
  availability: RecentProjectAvailability
  missingSourceCount: number
}

export type SaveRecoveryState =
  | { status: 'idle' | 'saved'; message?: undefined }
  | { status: 'saving'; message?: undefined }
  | { status: 'error'; message: string }

export interface CloseGuardState {
  hasUnsavedChanges: boolean
  saveInProgress: boolean
  extractionInProgress?: boolean
  exportInProgress?: boolean
}

export interface MissingSourceDocument {
  id: string
  name: string
}

export interface ReplacementSource {
  path: string
  name: string
  size: number
}

export function matchReplacementSources<T extends ReplacementSource>(
  missingDocuments: readonly MissingSourceDocument[],
  replacements: readonly T[]
): Map<string, T> {
  const matches = new Map<string, T>()
  const unused = [...replacements]

  for (const document of missingDocuments) {
    const replacementIndex = unused.findIndex(
      (candidate) => candidate.name.toLowerCase() === document.name.toLowerCase()
    )
    if (replacementIndex < 0) continue
    matches.set(document.id, unused[replacementIndex]!)
    unused.splice(replacementIndex, 1)
  }

  const unmatchedDocuments = missingDocuments.filter((document) => !matches.has(document.id))
  if (unmatchedDocuments.length !== unused.length) return matches
  unmatchedDocuments.forEach((document, index) => matches.set(document.id, unused[index]!))
  return matches
}

export function sortRecentProjects(
  projects: readonly RecentProjectRecoveryItem[]
): RecentProjectRecoveryItem[] {
  return [...projects].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name)
  )
}

export function shouldBlockClose(state: CloseGuardState): boolean {
  return (
    state.hasUnsavedChanges ||
    state.saveInProgress ||
    state.extractionInProgress === true ||
    state.exportInProgress === true
  )
}

export function closeGuardMessage(state: CloseGuardState): string | null {
  if (state.extractionInProgress)
    return 'Extraction is still running. Wait for it to finish or cancel it before closing.'
  if (state.exportInProgress)
    return 'An export is still running. Wait for it to finish before closing.'
  if (state.saveInProgress)
    return 'The project is still saving. Wait for it to finish before closing.'
  if (state.hasUnsavedChanges)
    return 'This project has unsaved changes. Retry saving before closing.'
  return null
}

export function saveFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'The project could not be saved. Check disk access and try again.'
}
