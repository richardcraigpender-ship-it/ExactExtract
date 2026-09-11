import assert from 'node:assert/strict'
import test from 'node:test'

import {
  collectTransactionContinuationLines,
  extractFinancialPayee,
  projectParserEntries
} from './entryProjection'
import { extractDocumentTextLayer } from './pipeline'
import type { ExtractedLine } from './types'

function line(id: string, text: string, y: number, pageNumber = 1): ExtractedLine {
  return {
    id,
    documentId: 'document-1',
    pageNumber,
    blockIds: [],
    text,
    bbox: { x: 40, y, width: 400, height: 10 },
    readingOrder: 0
  }
}

test('attaches the detail lines printed under a transaction row to that row', () => {
  const lines = [
    line('l1', '19 Mar 2026 Forest £2.99 £1,534.93', 700),
    line('l2', 'To Forest, London, GBR', 712),
    line('l3', 'Card 1112', 724),
    line('l4', '19 Mar 2026 Gopuff £26.34 £1,508.49', 748),
    line('l5', 'To Gopuff, London, GBR', 760)
  ]

  const continuations = collectTransactionContinuationLines(lines, new Set(['l1', 'l4']))

  assert.deepEqual(
    continuations.get('l1')?.map((detail) => detail.text),
    ['To Forest, London, GBR', 'Card 1112']
  )
  assert.deepEqual(
    continuations.get('l4')?.map((detail) => detail.text),
    ['To Gopuff, London, GBR']
  )
})

test('stops claiming detail lines across a page break or a large vertical gap', () => {
  const lines = [
    line('l1', '19 Mar 2026 Forest £2.99 £1,534.93', 700),
    line('l2', 'To Forest, London, GBR', 712),
    // A footer far below the last row must not be captured as a reference.
    line('l3', 'Page 1 of 325', 900),
    line('l4', 'Next page header', 40, 2)
  ]

  const continuations = collectTransactionContinuationLines(lines, new Set(['l1']))

  assert.deepEqual(
    continuations.get('l1')?.map((detail) => detail.text),
    ['To Forest, London, GBR']
  )
})

test('projects persisted entries with deterministic source traceability', () => {
  const result = extractDocumentTextLayer('document-1', [
    {
      documentId: 'document-1',
      pageNumber: 1,
      width: 612,
      height: 792,
      rotation: 0,
      items: [
        { str: 'Item', transform: [1, 0, 0, 10, 40, 700], width: 30, height: 10 },
        { str: 'Amount', transform: [1, 0, 0, 10, 200, 700], width: 45, height: 10 },
        { str: 'Service', transform: [1, 0, 0, 10, 40, 680], width: 45, height: 10 },
        { str: '120', transform: [1, 0, 0, 10, 200, 680], width: 20, height: 10 }
      ]
    }
  ])

  const entries = projectParserEntries(result, '2026-08-15T15:00:00.000Z')

  assert.equal(entries.length, 2)
  assert.equal(entries[0]?.id, 'document-1:p1:l1:entry')
  assert.equal(entries[0]?.status, 'maybe')
  assert.equal(entries[0]?.regions[0]?.documentId, 'document-1')
  assert.equal(entries[0]?.regions[0]?.tableId, 'document-1:p1:t1')
  assert.equal(entries[1]?.regions[0]?.rowIndex, 1)
  assert.equal(entries[0]?.category, 'paragraph')
  assert.deepEqual(entries[0]?.tags, ['semantic:paragraph', 'table-row'])
})

test('persists structural semantic categories without table metadata', () => {
  const result = extractDocumentTextLayer('document-1', [
    {
      documentId: 'document-1',
      pageNumber: 1,
      width: 612,
      height: 792,
      rotation: 0,
      items: [
        { str: 'Account:', transform: [1, 0, 0, 10, 40, 700], width: 50, height: 10 },
        { str: 'Receivables', transform: [1, 0, 0, 10, 95, 700], width: 65, height: 10 }
      ]
    }
  ])

  const entry = projectParserEntries(result, '2026-08-15T15:00:00.000Z')[0]

  assert.equal(entry?.category, 'key-value')
  assert.deepEqual(entry?.tags, ['semantic:key-value'])
  assert.equal(entry?.regions[0]?.documentId, 'document-1')
})

test('rejects invalid projection timestamps', () => {
  const result = extractDocumentTextLayer('document-1', [])
  assert.throws(() => projectParserEntries(result, 'not-a-date'), /timestamp/)
})

test('extracts financial payees before currency and multiple numeric columns', () => {
  assert.equal(
    extractFinancialPayee('20 March 2026 Northwind Power £1,200.50 0.00 8,410.20', true),
    'Northwind Power'
  )
  assert.equal(
    extractFinancialPayee('2026-04-02 Café Utilities € 82.15 1,000.00', true),
    'Café Utilities'
  )
  assert.equal(extractFinancialPayee('$120.00 50.00', true), undefined)
  assert.equal(extractFinancialPayee('Northwind Power $120.00', false), undefined)
})

test('extracts full incoming payment payee before trailing direction labels', () => {
  assert.equal(
    extractFinancialPayee('28th March 2026 Payment from MRS A. R. Smith money in £1,523.40', true),
    'Payment from MRS A. R. Smith'
  )
})

test('completes split payment-from payees from transaction detail lines', () => {
  const result = {
    documentId: 'document-1',
    pages: [],
    blocks: [],
    lines: [
      line('l1', '28th March 2026 Payment from £1,523.40', 700),
      line('l2', 'MRS A. R. Smith', 712),
      line('l3', 'Card 4165', 724),
      line('l4', '29th March 2026 Coffee £3.40', 748)
    ],
    tables: [],
    classification: {
      kind: 'tabular' as const,
      confidence: 0.9,
      scores: {},
      evidence: ['financial:statement']
    },
    preflight: { pages: [], recommendedMode: 'parser' as const, warnings: [] }
  }

  const entries = projectParserEntries(result, '2026-08-16T12:00:00.000Z')
  const payment = entries.find((entry) => entry.id === 'l1:entry')

  assert.equal(payment?.payee, 'Payment from MRS A. R. Smith')
  assert.equal(payment?.normalizedText, '28th March 2026 Payment from MRS A. R. Smith £1,523.40')
  assert.equal(payment?.reference, 'Card 4165')
  assert.equal(payment?.notes, undefined)
})

test('does not collect honorific-led personal text as a payee', () => {
  const sourceText = '02/04/2026 Dr Jane Smith $120.00'

  assert.equal(extractFinancialPayee(sourceText, true), undefined)

  const result = extractDocumentTextLayer('personal-financial-document', [
    {
      documentId: 'personal-financial-document',
      pageNumber: 1,
      width: 612,
      height: 792,
      rotation: 0,
      items: [
        { str: 'INVOICE', transform: [1, 0, 0, 12, 40, 700], width: 60, height: 12 },
        { str: sourceText, transform: [1, 0, 0, 10, 40, 680], width: 180, height: 10 }
      ]
    }
  ])
  const projected = projectParserEntries(result, '2026-08-22T00:00:00.000Z').find(
    (entry) => entry.rawText === sourceText
  )

  assert.equal(projected?.rawText, sourceText)
  assert.equal(projected?.payee, undefined)
})

test('projects born-digital financial rows with accounting values and traceability', () => {
  const result = extractDocumentTextLayer('financial-document', [
    {
      documentId: 'financial-document',
      pageNumber: 1,
      width: 612,
      height: 792,
      rotation: 0,
      items: [
        { str: 'BALANCE SHEET', transform: [1, 0, 0, 12, 40, 700], width: 100, height: 12 },
        { str: 'Cash', transform: [1, 0, 0, 10, 40, 680], width: 30, height: 10 },
        { str: '$1,200.50', transform: [1, 0, 0, 10, 200, 680], width: 60, height: 10 }
      ]
    }
  ])

  const entries = projectParserEntries(result, '2026-08-16T12:00:00.000Z')
  const cash = entries.find((entry) => entry.normalizedText === 'Cash $1,200.50')

  assert.equal(result.classification.kind, 'financial')
  assert.equal(cash?.category, 'accounting-entry')
  assert.equal(cash?.numericValue, 1200.5)
  assert.ok(cash?.tags.includes('accounting'))
  assert.equal(cash?.regions[0]?.documentId, 'financial-document')
  assert.equal(cash?.regions[0]?.pageNumber, 1)
})

test('calculates running totals from a configured add column', () => {
  const result = extractDocumentTextLayer(
    'document-1',
    [
      {
        documentId: 'document-1',
        pageNumber: 1,
        width: 612,
        height: 792,
        rotation: 0,
        items: [
          { str: 'Description', transform: [1, 0, 0, 10, 40, 700], width: 70, height: 10 },
          { str: 'Amount', transform: [1, 0, 0, 10, 200, 700], width: 45, height: 10 },
          { str: 'First', transform: [1, 0, 0, 10, 40, 680], width: 30, height: 10 },
          { str: '$10.00', transform: [1, 0, 0, 10, 200, 680], width: 40, height: 10 },
          { str: 'Second', transform: [1, 0, 0, 10, 40, 660], width: 35, height: 10 },
          { str: '$7.50', transform: [1, 0, 0, 10, 200, 660], width: 35, height: 10 }
        ]
      }
    ],
    undefined,
    {
      name: 'Totals',
      headerLabels: ['Description', 'Amount'],
      columns: [
        { name: 'Description', type: 'text', xStart: 30, xEnd: 150, required: true },
        {
          name: 'Amount',
          type: 'currency',
          xStart: 170,
          xEnd: 260,
          required: true,
          totalBehavior: 'add'
        }
      ]
    }
  )

  const entries = projectParserEntries(result, '2026-08-16T12:00:00.000Z')
  assert.deepEqual(
    entries
      .filter((entry) => entry.totalContribution !== undefined)
      .map((entry) => [entry.totalContribution, entry.runningTotal]),
    [
      [10, 10],
      [7.5, 17.5]
    ]
  )
})
