import type { ProjectEntry } from '../shared/contracts'

const REFERENCE_PATTERN =
  /\b(?:ref(?:erence)?|card|invoice|inv|order|po|receipt|transaction|txn|id)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{2,})\b/gi

function uniqueReferences(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const references: string[] = []
  for (const value of values) {
    const normalized = value.trim().toUpperCase()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    references.push(value.trim())
  }
  return references
}

export function extractEntryReferences(
  entry: Pick<ProjectEntry, 'normalizedText' | 'rawText'>
): string[] {
  const sourceText = [entry.normalizedText, entry.rawText].filter(Boolean).join('\n')
  return uniqueReferences(
    [...sourceText.matchAll(REFERENCE_PATTERN)].map((match) => match[1] ?? '')
  )
}

export interface CopyKeptReferencesResult {
  entries: ProjectEntry[]
  updatedEntryCount: number
  copiedReferenceCount: number
}

export function copyKeptEntryReferencesToNotes(
  entries: readonly ProjectEntry[],
  updatedAt: string
): CopyKeptReferencesResult {
  let updatedEntryCount = 0
  let copiedReferenceCount = 0
  const nextEntries = entries.map((entry) => {
    if (entry.status !== 'keep') return entry
    const references = extractEntryReferences(entry)
    if (references.length === 0) return entry
    const existingNotes = entry.notes?.trim() ?? ''
    const missing = references.filter(
      (reference) =>
        !new RegExp(`\\b${reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
          existingNotes
        )
    )
    if (missing.length === 0) return entry
    updatedEntryCount += 1
    copiedReferenceCount += missing.length
    return {
      ...entry,
      notes: existingNotes ? `${existingNotes}\n${missing.join(', ')}` : missing.join(', '),
      updatedAt
    }
  })

  return { entries: nextEntries, updatedEntryCount, copiedReferenceCount }
}
