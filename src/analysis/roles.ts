import { normalizeNumber } from './normalize'
import type { ColumnRole, ColumnRoleCandidate, ColumnRoleInference, ColumnSample } from './types'

const ROLE_ORDER: ColumnRole[] = [
  'label',
  'amount',
  'date',
  'count',
  'percent',
  'category',
  'ignore'
]

function candidate(role: ColumnRole, confidence: number, evidence: string[]): ColumnRoleCandidate {
  return { role, confidence: Math.max(0, Math.min(1, confidence)), evidence }
}

export function inferColumnRole(sample: ColumnSample): ColumnRoleInference {
  if (sample.explicitRole) {
    return {
      key: sample.key,
      selectedRole: sample.explicitRole,
      explicit: true,
      candidates: [candidate(sample.explicitRole, 1, ['Explicit user assignment.'])]
    }
  }

  const header = sample.header.trim().toLocaleLowerCase()
  const present = sample.values.filter(
    (value) => value !== null && value !== undefined && String(value).trim()
  )
  const numeric = present.filter((value) => normalizeNumber(value).value !== null)
  const percentages = present.filter((value) => normalizeNumber(value).isPercentage)
  const dates = present.filter((value) => !Number.isNaN(Date.parse(String(value))))
  const unique = new Set(present.map((value) => String(value).trim().toLocaleLowerCase()))
  const ratio = (count: number): number => (present.length === 0 ? 0 : count / present.length)
  const results: ColumnRoleCandidate[] = [
    candidate(
      'amount',
      Math.max(
        /amount|total|price|cost|revenue|balance/.test(header) ? 0.92 : 0,
        ratio(numeric.length) * 0.82
      ),
      ['Numeric density and amount-like header.']
    ),
    candidate(
      'percent',
      Math.max(
        /percent|percentage|rate|%/.test(header) ? 0.95 : 0,
        ratio(percentages.length) * 0.9
      ),
      ['Percentage markers or header.']
    ),
    candidate(
      'date',
      Math.max(/date|time|period|month|year/.test(header) ? 0.92 : 0, ratio(dates.length) * 0.85),
      ['Date-like values or header.']
    ),
    candidate(
      'count',
      Math.max(
        /count|quantity|qty|number/.test(header) ? 0.9 : 0,
        ratio(numeric.filter((value) => Number.isInteger(normalizeNumber(value).value)).length) *
          0.68
      ),
      ['Integer density or count-like header.']
    ),
    candidate(
      'category',
      Math.max(
        /category|type|group|class/.test(header) ? 0.9 : 0,
        present.length > 2 && unique.size <= Math.max(12, present.length / 2) ? 0.7 : 0
      ),
      ['Low cardinality or category-like header.']
    ),
    candidate(
      'label',
      Math.max(
        /label|name|description|item|title/.test(header) ? 0.9 : 0,
        present.length > 0 && numeric.length === 0 ? 0.65 : 0
      ),
      ['Text density or label-like header.']
    ),
    candidate('ignore', present.length === 0 ? 0.9 : 0.05, ['Empty columns are ignored.'])
  ].sort(
    (left, right) =>
      right.confidence - left.confidence ||
      ROLE_ORDER.indexOf(left.role) - ROLE_ORDER.indexOf(right.role)
  )

  return {
    key: sample.key,
    selectedRole: results[0]?.role ?? 'ignore',
    explicit: false,
    candidates: results
  }
}

export function inferColumnRoles(samples: readonly ColumnSample[]): ColumnRoleInference[] {
  return [...samples].sort((left, right) => left.key.localeCompare(right.key)).map(inferColumnRole)
}
