import type { ProjectEntry } from '../shared/contracts'
import type { AnalysisEntry } from './types'

function duplicateKey(entry: ProjectEntry): string | null {
  const text = entry.normalizedText
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase()
  return text.length >= 3 ? text : null
}

export function projectEntryToAnalysisEntry(entry: ProjectEntry): AnalysisEntry {
  return {
    id: entry.id,
    status: entry.status,
    value: entry.numericValue ?? entry.normalizedText,
    label: entry.normalizedText,
    date: entry.date ?? null,
    category: entry.category ?? null,
    confidence: entry.confidence,
    duplicateKey: duplicateKey(entry),
    uncertain: entry.status === 'maybe' || entry.tags.includes('uncertain'),
    outlier: entry.tags.includes('outlier')
  }
}

export function projectEntriesToAnalysis(entries: readonly ProjectEntry[]): AnalysisEntry[] {
  return [...entries]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(projectEntryToAnalysisEntry)
}
