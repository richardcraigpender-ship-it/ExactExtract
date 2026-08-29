import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CANONICAL_LENGTH_UNIT,
  LENGTH_UNITS,
  convertLength,
  formatLength,
  formatLengthWithUnit,
  fromPoints,
  isLengthUnit,
  parseLength,
  toPoints
} from './units'

test('points are the canonical unit and convert to themselves unchanged', () => {
  assert.equal(CANONICAL_LENGTH_UNIT, 'pt')
  assert.equal(toPoints(42, 'pt'), 42)
  assert.equal(fromPoints(42, 'pt'), 42)
})

test('one inch is 72 points, 25.4 millimetres, 2.54 centimetres, and 96 pixels', () => {
  assert.equal(toPoints(1, 'in'), 72)
  assert.ok(Math.abs(toPoints(25.4, 'mm') - 72) < 1e-9)
  assert.ok(Math.abs(toPoints(2.54, 'cm') - 72) < 1e-9)
  assert.ok(Math.abs(toPoints(96, 'px') - 72) < 1e-9)
})

test('every unit round-trips through points without drift', () => {
  for (const unit of LENGTH_UNITS) {
    assert.ok(Math.abs(fromPoints(toPoints(123.456, unit), unit) - 123.456) < 1e-9, unit)
  }
})

test('converts directly between two display units', () => {
  assert.ok(Math.abs(convertLength(10, 'mm', 'cm') - 1) < 1e-9)
  assert.ok(Math.abs(convertLength(1, 'in', 'px') - 96) < 1e-9)
})

test('formats a points value at a precision suited to the unit', () => {
  assert.equal(formatLength(72, 'pt'), '72.0')
  assert.equal(formatLength(72, 'mm'), '25.4')
  assert.equal(formatLength(72, 'in'), '1.00')
  assert.equal(formatLengthWithUnit(72, 'px'), '96.0 px')
  assert.equal(formatLength(Number.NaN, 'pt'), '')
})

test('parses input into points and lets a typed suffix win over the field unit', () => {
  assert.equal(parseLength('72', 'pt'), 72)
  assert.ok(Math.abs((parseLength('25.4', 'mm') ?? 0) - 72) < 1e-9)
  assert.ok(Math.abs((parseLength('1in', 'pt') ?? 0) - 72) < 1e-9)
  assert.ok(Math.abs((parseLength(' 96 px ', 'mm') ?? 0) - 72) < 1e-9)
  assert.equal(parseLength('-8', 'pt'), -8)
})

test('rejects input that is not a usable length', () => {
  assert.equal(parseLength('', 'pt'), null)
  assert.equal(parseLength('abc', 'pt'), null)
  assert.equal(parseLength('10 furlongs', 'pt'), null)
  assert.equal(parseLength('1.2.3', 'pt'), null)
})

test('recognises only supported units', () => {
  assert.equal(isLengthUnit('mm'), true)
  assert.equal(isLengthUnit('em'), false)
  assert.equal(isLengthUnit(72), false)
})
