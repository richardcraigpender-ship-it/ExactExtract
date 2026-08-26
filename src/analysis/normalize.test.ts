import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeNumber } from './normalize.ts'

test('normalizes common currencies and negative accounting values', () => {
  assert.equal(normalizeNumber('$1,234.56').value, 1234.56)
  assert.equal(normalizeNumber('€ 1.234,56').value, 1234.56)
  assert.equal(normalizeNumber('(£2,500.00)').value, -2500)
  assert.equal(normalizeNumber('−42').value, -42)
})

test('normalizes percentages as fractions by default', () => {
  assert.deepEqual(normalizeNumber('12.5%'), { value: 0.125, isPercentage: true })
  assert.equal(normalizeNumber('12.5%', { percentageAsFraction: false }).value, 12.5)
})

test('reports empty, invalid, and non-finite values without throwing', () => {
  assert.equal(normalizeNumber('  ').error, 'empty')
  assert.equal(normalizeNumber('not a number').error, 'invalid')
  assert.equal(normalizeNumber(Number.POSITIVE_INFINITY).error, 'non-finite')
})

test('supports explicit locale separators, narrow spaces, and trailing signs', () => {
  assert.equal(normalizeNumber('1\u202f234,50', { decimalSeparator: ',' }).value, 1234.5)
  assert.equal(normalizeNumber('1.234,50', { decimalSeparator: ',' }).value, 1234.5)
  assert.equal(normalizeNumber('1,234.50', { decimalSeparator: '.' }).value, 1234.5)
  assert.equal(normalizeNumber('125-', { decimalSeparator: '.' }).value, -125)
})

test('keeps ambiguous three-digit separators deterministic', () => {
  assert.equal(normalizeNumber('1,234').value, 1234)
  assert.equal(normalizeNumber('1.234').value, 1234)
  assert.equal(normalizeNumber('0,125', { decimalSeparator: ',' }).value, 0.125)
})
