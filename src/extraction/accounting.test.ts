import assert from 'node:assert/strict'
import test from 'node:test'

import { extractAccountingLineDetails } from './accounting'

test('extracts signed accounting amounts and unambiguous dates', () => {
  const details = extractAccountingLineDetails('2026-08-16 Office supplies (1,234.56)', true)

  assert.equal(details?.category, 'accounting-entry')
  assert.equal(details?.numericValue, -1234.56)
  assert.equal(details?.date, '2026-08-16')
})

test('extracts month-name dates from statement transaction rows', () => {
  const details = extractAccountingLineDetails('25 Aug 2024 Costa Coffee £15.45 £38.10', true)

  assert.equal(details?.date, '2024-08-25')
  assert.equal(details?.amountCount, 2)
})

test('normalizes locale amounts and credit suffixes', () => {
  const details = extractAccountingLineDetails('Ending balance 4.500,25 CR', true)

  assert.equal(details?.category, 'accounting-balance')
  assert.equal(details?.numericValue, -4500.25)
  assert.ok(details?.tags.includes('accounting:credit'))
})

test('excludes account codes and refuses to choose between debit and credit columns', () => {
  const details = extractAccountingLineDetails('4000 Sales revenue 1,200.00 350.00', true)

  assert.equal(details?.amountCount, 2)
  assert.equal(details?.numericValue, undefined)
  assert.ok(details?.tags.includes('accounting:account-code'))
  assert.ok(details?.tags.includes('accounting:multi-amount'))
})

test('does not relabel ordinary account key-value text outside a financial document', () => {
  assert.equal(extractAccountingLineDetails('Account: Receivables'), null)
})
