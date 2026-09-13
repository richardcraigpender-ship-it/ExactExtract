import type { ProjectEntry, ReviewStatus } from './contracts'
import { normalizeMerchantKey, type MerchantRecord, type MerchantRuleDecision } from './merchants'

export interface MerchantRuleMatch {
  entryId: string
  currentStatus: ReviewStatus
  /** True only when applying the rule would actually change this entry's status. */
  willChange: boolean
}

export interface MerchantRulePreview {
  merchantId: string
  targetStatus: ReviewStatus
  matches: MerchantRuleMatch[]
  affectedCount: number
  /** Entries with an existing explicit (non-'maybe') decision that disagrees with the rule. */
  conflictCount: number
}

/** Matches by normalized payee text since entries are not yet linked to a merchant id at capture time. */
export function findMerchantMatchingEntries(
  merchant: MerchantRecord,
  entries: readonly ProjectEntry[]
): ProjectEntry[] {
  const keys = new Set([
    merchant.normalizedKey,
    ...merchant.aliases.map((alias) => normalizeMerchantKey(alias))
  ])
  return entries.filter((entry) => entry.payee && keys.has(normalizeMerchantKey(entry.payee)))
}

/**
 * Previews what a merchant's default-review rule would do without changing anything, so the UI
 * can show an affected-entry count and flag conflicts before the user confirms.
 */
export function previewMerchantDefaultStatusRule(
  merchant: MerchantRecord,
  entries: readonly ProjectEntry[]
): MerchantRulePreview | undefined {
  const targetStatus = merchant.defaultReviewStatus
  if (!targetStatus) return undefined
  const matches: MerchantRuleMatch[] = findMerchantMatchingEntries(merchant, entries).map(
    (entry) => ({
      entryId: entry.id,
      currentStatus: entry.status,
      willChange: entry.status !== targetStatus
    })
  )
  const conflicts = matches.filter(
    (match) => match.willChange && match.currentStatus !== 'maybe'
  )
  return {
    merchantId: merchant.id,
    targetStatus,
    matches,
    affectedCount: matches.filter((match) => match.willChange).length,
    conflictCount: conflicts.length
  }
}

export interface ApplyMerchantRuleResult {
  entries: ProjectEntry[]
  decision: MerchantRuleDecision
  changedEntryIds: string[]
}

export function applyMerchantDefaultStatusRules(
  entries: readonly ProjectEntry[],
  merchants: readonly MerchantRecord[],
  updatedAt: string
): { entries: ProjectEntry[]; decisions: MerchantRuleDecision[]; changedEntryIds: string[] } {
  let nextEntries = [...entries]
  const decisions: MerchantRuleDecision[] = []
  const changedEntryIds: string[] = []
  for (const merchant of merchants) {
    if (!merchant.defaultReviewStatus) continue
    const result = applyMerchantDefaultStatusRule(nextEntries, merchant, updatedAt)
    nextEntries = result.entries
    if (result.changedEntryIds.length > 0) {
      decisions.push(result.decision)
      changedEntryIds.push(...result.changedEntryIds)
    }
  }
  return { entries: nextEntries, decisions, changedEntryIds }
}

/**
 * Applies a merchant's default-review rule. Entries with an existing explicit decision are left
 * alone unless the caller explicitly opts to override conflicts; 'maybe' entries are always safe
 * to auto-decide since they have not been manually reviewed yet.
 */
export function applyMerchantDefaultStatusRule(
  entries: readonly ProjectEntry[],
  merchant: MerchantRecord,
  updatedAt: string,
  options: { overrideConflicts?: boolean } = {}
): ApplyMerchantRuleResult {
  const targetStatus = merchant.defaultReviewStatus
  if (!targetStatus) throw new Error('Merchant has no default review status rule to apply.')
  const matchingIds = new Set(findMerchantMatchingEntries(merchant, entries).map((entry) => entry.id))
  const changedEntryIds: string[] = []
  const nextEntries = entries.map((entry) => {
    if (!matchingIds.has(entry.id) || entry.status === targetStatus) return entry
    if (entry.status !== 'maybe' && !options.overrideConflicts) return entry
    changedEntryIds.push(entry.id)
    return { ...entry, status: targetStatus, updatedAt }
  })
  const decision: MerchantRuleDecision = {
    id: crypto.randomUUID(),
    merchantId: merchant.id,
    action: 'set-default-status',
    value: targetStatus,
    appliedToEntryIds: changedEntryIds,
    reversible: true,
    createdAt: updatedAt
  }
  return { entries: nextEntries, decision, changedEntryIds }
}
