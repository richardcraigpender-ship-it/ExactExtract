export const MERCHANT_LIBRARY_SCHEMA_VERSION = 1 as const

export type MerchantClassification =
  'merchant-candidate' | 'likely-personal' | 'unknown' | 'excluded'

export type MerchantClassificationReason =
  'transfer-prefix' | 'email-address' | 'phone-number' | 'account-like-number'

export interface MerchantProvenanceReference {
  projectId: string
  entryId: string
  documentId?: string
  pageNumber?: number
  regionId?: string
  amount?: number
  direction?: 'in' | 'out'
  transactionDate?: string
  seenAt: string
}

export interface MerchantRecord {
  id: string
  canonicalDisplayName: string
  normalizedKey: string
  aliases: string[]
  classification: Exclude<MerchantClassification, 'likely-personal' | 'unknown'>
  classificationReasons: MerchantClassificationReason[]
  userOverride: boolean
  category?: string
  recurring: boolean
  forecastIncluded: boolean
  direction?: 'in' | 'out'
  defaultAmount?: number
  defaultCadence?: string
  notes?: string
  occurrenceCount: number
  provenance: MerchantProvenanceReference[]
  firstSeenAt: string
  lastSeenAt: string
  createdAt: string
  updatedAt: string
}

export interface MerchantCandidate {
  description: string
  normalizedKey: string
  classification: MerchantClassification
  reasons: MerchantClassificationReason[]
}

export interface MerchantObservation extends MerchantProvenanceReference {
  description: string
}

export interface MerchantCreate {
  displayName: string
  aliases?: string[]
  category?: string
  recurring?: boolean
  forecastIncluded?: boolean
  direction?: 'in' | 'out'
  defaultAmount?: number
  defaultCadence?: string
  notes?: string
}

export interface MerchantUpdate extends Partial<Omit<MerchantCreate, 'displayName'>> {
  displayName?: string
  classification?: Extract<MerchantClassification, 'merchant-candidate' | 'excluded'>
}

export type MerchantRuleAction =
  | 'set-category'
  | 'set-canonical-name'
  | 'add-alias'
  | 'set-recurring'
  | 'set-default-status'

/**
 * An auditable record of a user-approved rule being applied to future matching entries. Distinct
 * from the record's current fields so applied rules stay reversible and traceable to entries.
 */
export interface MerchantRuleDecision {
  id: string
  merchantId: string
  action: MerchantRuleAction
  value: string | boolean
  appliedToEntryIds: string[]
  reversible: boolean
  createdAt: string
  reversedAt?: string
}

export function normalizeMerchantKey(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u2010-\u2015-]+/g, ' ')
    .replace(/[.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const TRANSFER_PREFIX = /^(?:transfer(?:red)?\s+(?:to|from)|sent\s+(?:to|by)|paid\s+(?:to|by))\b/i
const EMAIL_ADDRESS = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/
const PHONE_NUMBER = /(?:\+?\d[\s().-]*){8,}\d/
const ACCOUNT_LIKE_NUMBER = /\b(?:\d[ -]?){10,}\d\b/

export function classifyMerchantCandidate(description: string): MerchantCandidate {
  const normalizedKey = normalizeMerchantKey(description)
  const reasons: MerchantClassificationReason[] = []
  if (TRANSFER_PREFIX.test(description.trim())) reasons.push('transfer-prefix')
  if (EMAIL_ADDRESS.test(description)) reasons.push('email-address')
  if (PHONE_NUMBER.test(description)) reasons.push('phone-number')
  if (ACCOUNT_LIKE_NUMBER.test(description)) reasons.push('account-like-number')
  return {
    description: description.replace(/\s+/g, ' ').trim(),
    normalizedKey,
    classification:
      reasons.length > 0 ? 'likely-personal' : normalizedKey ? 'merchant-candidate' : 'unknown',
    reasons
  }
}
