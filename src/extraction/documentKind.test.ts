import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyPage } from './classification'
import { detectDocumentKind } from './documentKind'
import { parseTextLayerPage } from './textLayer'
import type { ClassifiedPage } from './types'

function classifiedPage(texts: string[]): ClassifiedPage {
  return classifyPage(
    parseTextLayerPage({
      documentId: 'document-1',
      pageNumber: 1,
      width: 612,
      height: 792,
      rotation: 0,
      items: texts.map((str, index) => ({
        str,
        transform: [1, 0, 0, 10, 40, 700 - index * 20] as const,
        width: 200,
        height: 10
      }))
    })
  )
}

test('detects invoice documents with evidence', () => {
  const result = detectDocumentKind([
    classifiedPage(['INVOICE', 'Invoice number 42', 'Subtotal 100', 'Amount due 120'])
  ])

  assert.equal(result.kind, 'invoice')
  assert.ok(result.evidence.some((item) => item.startsWith('invoice:')))
})

test('detects statistical documents from measures and percentages', () => {
  const result = detectDocumentKind([
    classifiedPage([
      'Sample size 50',
      'Mean 12',
      'Standard deviation 3',
      'Group A 40%',
      'Group B 60%'
    ])
  ])

  assert.equal(result.kind, 'statistical')
  assert.ok(result.scores.statistical >= 5)
})

test('reports mixed documents when strong kinds compete', () => {
  const result = detectDocumentKind([
    classifiedPage(['Annual report', 'Executive summary', 'Balance sheet', 'Net income'])
  ])

  assert.equal(result.kind, 'mixed')
})

test('returns unknown when no strong signals exist', () => {
  const result = detectDocumentKind([classifiedPage(['ordinary prose without domain terms'])])
  assert.equal(result.kind, 'unknown')
  assert.equal(result.scores.unknown, 1)
})

test('detects born-digital accounting ledgers and trial balances', () => {
  const result = detectDocumentKind([
    classifiedPage(['TRIAL BALANCE', 'Account Debit Credit', 'Cash 1,200.00 0.00'])
  ])

  assert.equal(result.kind, 'financial')
  assert.ok(result.evidence.some((item) => item.includes('accounting records')))
})
