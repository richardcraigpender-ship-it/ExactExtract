export const PAYEE_LIBRARY_SCHEMA_VERSION = 2 as const

export interface PayeeProvenanceReference {
  projectId: string
  entryId: string
  seenAt: string
}

export interface PayeeRecord {
  id: string
  canonicalDisplayName: string
  normalizedKey: string
  occurrenceCount: number
  provenance: PayeeProvenanceReference[]
  firstSeenAt: string
  lastSeenAt: string
}

export interface PayeeObservation {
  description: string
  projectId: string
  entryId: string
  seenAt: string
}
