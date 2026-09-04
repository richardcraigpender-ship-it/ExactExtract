import { normalizeMerchantKey, type MerchantRecord } from '../../../shared/merchants'

export type MerchantLibraryFilter =
  'all' | 'approved' | 'review' | 'personal' | 'excluded' | 'recurring' | 'project' | 'unlinked'

export const MERCHANT_FILTERS: ReadonlyArray<{ id: MerchantLibraryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'approved', label: 'Approved' },
  { id: 'review', label: 'Review needed' },
  { id: 'personal', label: 'Likely personal' },
  { id: 'excluded', label: 'Excluded' },
  { id: 'recurring', label: 'Recurring' },
  { id: 'project', label: 'This project' },
  { id: 'unlinked', label: 'Unlinked' }
]

/** A record still carrying detection flags that the user has not ruled on yet. */
export function isLikelyPersonal(record: MerchantRecord): boolean {
  return record.classificationReasons.length > 0 && !record.userOverride
}

export function isApproved(record: MerchantRecord): boolean {
  return record.classification === 'merchant-candidate' && record.userOverride
}

export function needsReview(record: MerchantRecord): boolean {
  return record.classification === 'merchant-candidate' && !record.userOverride
}

export function filterMerchantRecords(
  records: readonly MerchantRecord[],
  filter: MerchantLibraryFilter,
  query: string,
  projectId?: string
): MerchantRecord[] {
  const normalizedQuery = normalizeMerchantKey(query)
  return records.filter((record) => {
    if (normalizedQuery) {
      const haystack = [record.canonicalDisplayName, record.normalizedKey, ...record.aliases]
        .map((value) => normalizeMerchantKey(value))
        .join(' ')
      if (!haystack.includes(normalizedQuery)) return false
    }
    switch (filter) {
      case 'approved':
        return isApproved(record)
      case 'review':
        return needsReview(record) && !isLikelyPersonal(record)
      case 'personal':
        return isLikelyPersonal(record)
      case 'excluded':
        return record.classification === 'excluded'
      case 'recurring':
        return record.recurring
      case 'project':
        return projectId ? record.provenance.some((entry) => entry.projectId === projectId) : false
      case 'unlinked':
        return record.provenance.length === 0
      default:
        return true
    }
  })
}
