import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import test from 'node:test'

import { calculateStatementStats } from '../analysis/statementStats'
import { extractPdfJsDocument, projectParserEntries } from './index'
import { adaptRevolutTransaction } from './revolutAdapter'

test('expands omitted Revolut zero columns into explicit financial columns', () => {
  assert.equal(
    adaptRevolutTransaction('25 Aug 2024 Payment from PENDER RC £11.23 £25.18'),
    '25 Aug 2024 Payment from PENDER RC £0.00 £11.23 £25.18'
  )
  assert.equal(
    adaptRevolutTransaction('25 Aug 2024 To Costa Coffee £15.45 £38.10'),
    '25 Aug 2024 To Costa Coffee £15.45 £0.00 £38.10'
  )
  assert.equal(
    adaptRevolutTransaction('25 Aug 2024 Costa Coffee £15.45 £38.10'),
    '25 Aug 2024 Costa Coffee £15.45 £0.00 £38.10'
  )
  assert.equal(
    adaptRevolutTransaction('29 Nov 2024 Booking.com £91.80 £955.35', 863.55),
    '29 Nov 2024 Booking.com £0.00 £91.80 £955.35'
  )
})

test('projects the representative Revolut statement without identifier digits as money', async () => {
  const bytes = new Uint8Array(
    await readFile('test-data/fixtures/RichardPenderRevolut 2023 to 2026-part-2 (1)-part-2.pdf')
  )
  const pdf = await getDocument({
    data: bytes,
    disableWorker: true,
    standardFontDataUrl: './node_modules/pdfjs-dist/standard_fonts/'
  }).promise

  try {
    const extraction = await extractPdfJsDocument('revolut-part-2', pdf, '2026-08-24T00:00:00.000Z')
    const entries = projectParserEntries(extraction, '2026-08-24T00:00:00.000Z')
    const stats = calculateStatementStats(
      entries,
      {
        amountColumns: ['money-out', 'money-in', 'balance'],
        dateSource: 'detected-date',
        descriptionSource: 'detected-description',
        referenceSource: 'ignore',
        categorySource: 'entry-category'
      },
      'all'
    )
    const numericValues = entries
      .map((entry) => entry.numericValue)
      .filter((value): value is number => value !== undefined)

    assert.equal(extraction.pages.length, 29)
    assert.equal(extraction.classification.kind, 'tabular')
    assert.equal(entries.length, 574)
    assert.equal(entries.filter((entry) => entry.date).length, 574)
    assert.ok(entries.every((entry) => entry.regions.length > 0))
    assert.ok(entries.every((entry) => entry.payee))
    assert.ok(numericValues.every((value) => Math.abs(value) < 10_000))
    assert.ok(
      entries.every(
        (entry) =>
          !/payment service regulations|financial conduct authority|generated on/i.test(
            entry.normalizedText
          )
      )
    )
    assert.equal(stats.moneyOut, 7542.18)
    assert.equal(stats.moneyIn, 8729.21)
    assert.equal(stats.openingBalance, 53.55)
    assert.equal(stats.closingBalance, 1240.58)
    assert.equal(stats.calculatedClosingBalance, 1240.58)
    assert.equal(stats.difference, 0)
    assert.ok(stats.reconciled)
  } finally {
    await pdf.destroy()
  }
})

test('accepts the compact Revolut part 1 financial statement with exact reconciliation', async () => {
  const bytes = new Uint8Array(
    await readFile('test-data/fixtures/RichardPenderRevolut 2023 to 2026-part-1.pdf')
  )
  const pdf = await getDocument({
    data: bytes,
    disableWorker: true,
    standardFontDataUrl: './node_modules/pdfjs-dist/standard_fonts/'
  }).promise

  try {
    const extraction = await extractPdfJsDocument('revolut-part-1', pdf, '2026-08-25T00:00:00.000Z')
    const entries = projectParserEntries(extraction, '2026-08-25T00:00:00.000Z')
    const stats = calculateStatementStats(
      entries,
      {
        amountColumns: ['money-out', 'money-in', 'balance'],
        dateSource: 'detected-date',
        descriptionSource: 'detected-description',
        referenceSource: 'ignore',
        categorySource: 'entry-category'
      },
      'all'
    )

    assert.equal(extraction.pages.length, 1)
    assert.equal(extraction.classification.kind, 'tabular')
    assert.equal(entries.length, 8)
    assert.ok(entries.every((entry) => entry.date && entry.payee && entry.regions.length > 0))
    assert.equal(stats.moneyOut, 54.24)
    assert.equal(stats.moneyIn, 170)
    assert.equal(stats.netMovement, 115.76)
    assert.equal(stats.openingBalance, 0)
    assert.equal(stats.closingBalance, 115.76)
    assert.equal(stats.calculatedClosingBalance, 115.76)
    assert.equal(stats.difference, 0)
    assert.ok(stats.reconciled)
  } finally {
    await pdf.destroy()
  }
})
