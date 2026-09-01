import assert from 'node:assert/strict'
import test from 'node:test'

import { extractDocumentTextLayer } from './pipeline'

test('extracts ordered blocks and frozen-contract preflight data', () => {
  const result = extractDocumentTextLayer(
    'invoice-document',
    [
      {
        documentId: 'invoice-document',
        pageNumber: 2,
        width: 612,
        height: 792,
        rotation: 0,
        imageObjectCount: 1,
        items: []
      },
      {
        documentId: 'invoice-document',
        pageNumber: 1,
        width: 612,
        height: 792,
        rotation: 0,
        items: [
          {
            str: 'INVOICE',
            fontName: 'ABCDEE+InvoiceSans-Bold',
            transform: [1, 0, 0, 16, 40, 700],
            width: 80,
            height: 16
          },
          {
            str: 'Amount due 200',
            fontName: 'ABCDEE+InvoiceSans-Regular',
            transform: [1, 0, 0, 10, 40, 680],
            width: 100,
            height: 10
          }
        ]
      }
    ],
    '2026-08-15T12:00:00.000Z'
  )

  assert.equal(result.classification.kind, 'invoice')
  assert.deepEqual(
    result.preflight.pages.map((page) => page.pageNumber),
    [1, 2]
  )
  assert.equal(result.preflight.pages[1]?.ocrRecommended, true)
  assert.equal(result.preflight.completedAt, '2026-08-15T12:00:00.000Z')
  assert.equal(result.blocks.length, 2)
  assert.equal(result.styleProfile?.source, 'pdf-text')
  assert.equal(result.styleProfile?.generatedAt, '2026-08-15T12:00:00.000Z')
  assert.ok(result.styleProfile?.textStyles.some((style) => style.likelyRole === 'header'))
})

test('rejects pages from another document', () => {
  assert.throws(
    () =>
      extractDocumentTextLayer('document-1', [
        {
          documentId: 'document-2',
          pageNumber: 1,
          width: 100,
          height: 100,
          rotation: 0,
          items: []
        }
      ]),
    /belong to documentId/
  )
})
