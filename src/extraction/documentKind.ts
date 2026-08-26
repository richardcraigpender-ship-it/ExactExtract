import type { DocumentKind } from '../shared/contracts'
import type { ClassifiedPage, DocumentClassification } from './types'

type ScoredKind = Exclude<DocumentKind, 'mixed' | 'unknown'>

const RULES: Record<ScoredKind, readonly [RegExp, number, string][]> = {
  invoice: [
    [/\binvoice\b/i, 3, 'invoice terminology'],
    [/\bamount due\b/i, 2, 'amount due'],
    [/\b(subtotal|bill to|invoice number)\b/i, 1, 'billing fields']
  ],
  financial: [
    [/\bbalance sheet\b/i, 3, 'balance sheet'],
    [
      /\b(income statement|profit and loss|statement of cash flows?|cash flow)\b/i,
      3,
      'financial statements'
    ],
    [/\b(trial balance|general ledger|chart of accounts)\b/i, 3, 'accounting records'],
    [/\b(accounts? payable|accounts? receivable|net income)\b/i, 2, 'accounting balances'],
    [
      /\b(debit|credit|balance|revenue|expenses?|assets?|liabilities|equity)\b/i,
      1,
      'financial terminology'
    ]
  ],
  statistical: [
    [/\bstandard deviation\b/i, 3, 'standard deviation'],
    [/\b(median|sample size)\b/i, 2, 'statistical measures'],
    [/\b(mean|average|percentile|variance)\b/i, 1, 'statistical terminology']
  ],
  tabular: [
    [/\b(quantity|unit price|column|row total)\b/i, 2, 'table terminology'],
    [/\b(table|schedule)\s+\d+/i, 1, 'numbered table']
  ],
  report: [
    [/\bexecutive summary\b/i, 3, 'executive summary'],
    [/\b(introduction|conclusion|findings|methodology)\b/i, 1, 'report sections'],
    [/\bannual report\b/i, 2, 'report title']
  ]
}

function createScores(): Record<DocumentKind, number> {
  return { report: 0, invoice: 0, statistical: 0, financial: 0, tabular: 0, mixed: 0, unknown: 0 }
}

export function detectDocumentKind(pages: readonly ClassifiedPage[]): DocumentClassification {
  const scores = createScores()
  const evidence: string[] = []
  const text = pages.flatMap((page) => page.blocks.map((block) => block.text)).join('\n')

  for (const [kind, rules] of Object.entries(RULES) as [ScoredKind, (typeof RULES)[ScoredKind]][]) {
    for (const [pattern, weight, label] of rules) {
      if (!pattern.test(text)) continue
      scores[kind] += weight
      evidence.push(`${kind}: ${label}`)
    }
  }

  const blocks = pages.flatMap((page) => page.blocks)
  const numericBlocks = blocks.filter((block) => /\d/.test(block.text)).length
  if (blocks.length >= 4 && numericBlocks / blocks.length >= 0.5) {
    scores.tabular += 2
    evidence.push('tabular: numeric block density')
  }

  const percentMatches = text.match(/\b\d+(?:\.\d+)?\s*%/g)?.length ?? 0
  if (percentMatches >= 2) {
    scores.statistical += 2
    evidence.push('statistical: repeated percentages')
  }

  const ranked = (Object.entries(scores) as [DocumentKind, number][])
    .filter(([kind]) => kind !== 'mixed' && kind !== 'unknown')
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  const [first, second] = ranked

  if (!first || first[1] === 0) {
    scores.unknown = 1
    return { kind: 'unknown', confidence: 0.25, scores, evidence: ['unknown: no strong signals'] }
  }

  const isMixed = Boolean(second && second[1] >= 3 && first[1] - second[1] <= 1)
  const kind: DocumentKind = isMixed ? 'mixed' : first[0]
  if (isMixed) {
    scores.mixed = first[1] + (second?.[1] ?? 0)
    evidence.push(`mixed: ${first[0]} and ${second?.[0]}`)
  }

  const competingScore = second?.[1] ?? 0
  const confidence = Math.min(0.98, 0.55 + (first[1] - competingScore) * 0.08 + first[1] * 0.03)
  return { kind, confidence: isMixed ? Math.max(0.65, confidence) : confidence, scores, evidence }
}
