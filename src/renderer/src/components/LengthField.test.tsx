import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { LengthField } from './LengthField'
import { resolveLengthCommit } from '../../../shared/units'
import { LengthUnitSelect } from './LengthUnitSelect'
import { getLengthUnit, setLengthUnit } from '../lib/lengthUnitStore'

void React

test.afterEach(() => setLengthUnit('pt'))

test('shows a points value in the active unit and names the unit in the label', () => {
  const points = renderToStaticMarkup(
    <LengthField label="X start" value={72} onChange={() => {}} />
  )
  setLengthUnit('mm')
  const millimetres = renderToStaticMarkup(
    <LengthField label="X start" value={72} onChange={() => {}} />
  )

  assert.match(points, /X start \(pt\)/)
  assert.match(points, /value="72\.0"/)
  assert.match(millimetres, /X start \(mm\)/)
  assert.match(millimetres, /value="25\.4"/)
})

test('uses text input so values may include a unit suffix', () => {
  const markup = renderToStaticMarkup(<LengthField label="Width" value={10} onChange={() => {}} />)

  assert.match(markup, /type="text"/)
  assert.match(markup, /inputMode="decimal"/)
  assert.match(markup, /unit suffixes such as mm or in are accepted/)
})

test('offers every supported unit and marks the active one', () => {
  setLengthUnit('cm')
  const markup = renderToStaticMarkup(<LengthUnitSelect />)

  assert.match(markup, /aria-label="Coordinate and size units"/)
  for (const unit of ['pt', 'mm', 'cm', 'in', 'px']) {
    assert.match(markup, new RegExp(`value="${unit}"`))
  }
  assert.match(markup, /<option value="cm" selected="">/)
})

test('the store ignores values that are not supported units', () => {
  setLengthUnit('mm')
  setLengthUnit('em' as never)

  assert.equal(getLengthUnit(), 'mm')
})

test('an optional field renders empty for null and says so in its label', () => {
  const markup = renderToStaticMarkup(
    <LengthField label="Width" optional value={null} onChange={() => {}} placeholder="Auto" />
  )

  assert.match(markup, /Width \(pt, optional\)/)
  assert.match(markup, /value=""/)
  assert.match(markup, /placeholder="Auto"/)
})

test('an optional field commits empty input as null instead of zero', () => {
  assert.equal(resolveLengthCommit('', { unit: 'pt', optional: true }), null)
  assert.equal(resolveLengthCommit('   ', { unit: 'pt', optional: true }), null)
  assert.equal(resolveLengthCommit('72', { unit: 'pt', optional: true }), 72)
})

test('a required field rejects empty input so the previous value is restored', () => {
  assert.equal(resolveLengthCommit('', { unit: 'pt' }), undefined)
  assert.equal(resolveLengthCommit('nonsense', { unit: 'pt', optional: true }), undefined)
})

test('commits are converted from the active unit and clamped', () => {
  assert.ok(Math.abs((resolveLengthCommit('25.4', { unit: 'mm' }) ?? 0) - 72) < 1e-9)
  assert.equal(resolveLengthCommit('-5', { unit: 'pt', min: 0 }), 0)
  assert.equal(resolveLengthCommit('500', { unit: 'pt', max: 100 }), 100)
})

test('accepts explicit unit suffixes through the same field parser', () => {
  assert.equal(resolveLengthCommit('1in', { unit: 'mm' }), 72)
  assert.ok(Math.abs((resolveLengthCommit('25.4mm', { unit: 'pt' }) ?? 0) - 72) < 1e-9)
})
