import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { projectParserEntries } from './entryProjection'
import { extractDocumentTextLayer } from './pipeline'

test('extracts a born-digital accounting statement into traceable accounting entries', () => {
  const fixture = JSON.parse(
    readFileSync(
      join(process.cwd(), 'test-data', 'fixtures', 'digital-accounting-statement.json'),
      'utf8'
    )
  ) as {
    documentId: string
    pages: Array<{
      pageNumber: number
      width: number
      height: number
      rotation: 0 | 90 | 180 | 270
      items: Array<{ str: string; x: number; y: number; width: number; height: number }>
    }>
  }

  const result = extractDocumentTextLayer(
    fixture.documentId,
    fixture.pages.map((page) => ({
      documentId: fixture.documentId,
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
      rotation: page.rotation,
      items: page.items.map((item) => ({
        str: item.str,
        transform: [1, 0, 0, item.height, item.x, item.y] as const,
        width: item.width,
        height: item.height
      }))
    })),
    '2026-08-16T12:00:00.000Z'
  )
  const entries = projectParserEntries(result, '2026-08-16T12:00:00.000Z')

  assert.equal(result.classification.kind, 'financial')
  assert.equal(result.preflight.pages[0]?.ocrRecommended, false)
  assert.equal(entries.length, 6)

  const supplies = entries.find((entry) => entry.normalizedText.includes('Office supplies'))
  const balance = entries.find((entry) => entry.normalizedText.startsWith('Ending balance'))
  const debitCredit = entries.find((entry) => entry.normalizedText.includes('Sales revenue'))
  const dateEntry = entries.find((entry) => entry.normalizedText.startsWith('As of'))

  assert.equal(supplies?.numericValue, -125.5)
  assert.equal(balance?.numericValue, -4500.25)
  assert.equal(dateEntry?.date, '2026-08-16')
  assert.equal(debitCredit?.numericValue, undefined)
  assert.ok(debitCredit?.tags.includes('accounting:multi-amount'))
  assert.ok(entries.every((entry) => entry.regions[0]?.documentId === fixture.documentId))
  assert.ok(entries.every((entry) => entry.regions[0]?.pageNumber === 1))
})
