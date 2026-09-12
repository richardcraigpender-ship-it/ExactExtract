import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { HighlightToolPanel, type HighlightToolPanelProps } from './HighlightToolPanel'
import { setLengthUnit } from '../lib/lengthUnitStore'

const measurements = { status: 'measured' as const, x: 20, y: 280, width: 60, height: 40 }

function render(overrides: Partial<HighlightToolPanelProps> = {}): string {
  const props: HighlightToolPanelProps = {
    visible: true,
    editMode: false,
    styleMode: 'filled',
    scope: 'entry',
    affectedCount: 3,
    measurements,
    lastResult: null,
    onChangeVisible: () => {},
    onChangeEditMode: () => {},
    onChangeStyleMode: () => {},
    onChangeScope: () => {},
    onApply: () => {},
    ...overrides
  }
  return renderToStaticMarkup(React.createElement(HighlightToolPanel, props))
}

test.afterEach(() => setLengthUnit('pt'))

// HT-C-001
test('renders visibility, edit mode, and style controls', () => {
  const markup = render()
  assert.match(markup, /Show highlights/)
  assert.match(markup, /Enable drag and resize/)
  assert.match(markup, /Border only/)
})

// HT-C-002
test('previews how many highlights the current scope affects', () => {
  assert.match(render({ affectedCount: 3 }), /3 highlights will be updated\./)
  assert.match(render({ affectedCount: 1 }), /1 highlight will be updated\./)
})

// HT-C-003
test('disables apply when no highlights are in scope', () => {
  const markup = render({ affectedCount: 0 })
  assert.match(markup, /No highlights match this scope\./)
  assert.match(markup, /<button[^>]*disabled[^>]*>Apply<\/button>/)
})

// HT-C-004
test('disables edit mode and style when highlights are hidden', () => {
  const markup = render({ visible: false })
  const editCheckbox = markup.match(/<input type="checkbox"[^>]*>/g) ?? []
  assert.equal(editCheckbox.length, 2)
  assert.match(editCheckbox[1], /disabled/)
  assert.match(markup, /<select disabled=""/)
})

// HT-C-005
test('reports the outcome of the last apply in a live region', () => {
  const markup = render({ lastResult: 'Updated 2 highlights across 1 entry.' })
  assert.match(markup, /aria-live="polite"/)
  assert.match(markup, /Updated 2 highlights across 1 entry\./)
})

test('does not expose review status actions in the marks panel', () => {
  const markup = render()

  assert.doesNotMatch(markup, /Mark entries/)
  assert.doesNotMatch(markup, /Keep/)
  assert.doesNotMatch(markup, /Maybe/)
  assert.doesNotMatch(markup, /Exclude/)
})

test('offers undo and redo for highlight changes', () => {
  const markup = render({
    canUndo: true,
    canRedo: false,
    onUndo: () => {},
    onRedo: () => {}
  })

  assert.match(markup, /Highlight history/)
  assert.match(markup, /aria-label="Undo highlight change"/)
  assert.match(markup, /aria-label="Redo highlight change"[^>]*disabled/)
})

// HT-C-006
test('associates the value input with its validation message', () => {
  const markup = render()
  assert.match(markup, /aria-describedby="highlight-tool-validation"/)
  assert.match(markup, /id="highlight-tool-validation"/)
})

// HT-C-007
test('offers the shared unit scale and no percent option', () => {
  const markup = render()
  assert.match(markup, /aria-label="Coordinate and size units"/)
  for (const unit of ['pt', 'mm', 'cm', 'in', 'px']) {
    assert.match(markup, new RegExp(`value="${unit}"`))
  }
  assert.doesNotMatch(markup, /Percent of page/)
  assert.match(markup, /Value \(pt\)/)
})

// HT-C-008
test('shows the selected highlight position in the active unit', () => {
  const points = render()
  setLengthUnit('mm')
  const millimetres = render()

  assert.match(points, /Selected highlight/)
  assert.match(points, /<td>280\.0<\/td>/)
  // 280pt is 98.8mm
  assert.match(millimetres, /<td>98\.8<\/td>/)
  assert.doesNotMatch(millimetres, /<td>280\.0<\/td>/)
})

// HT-C-009
test('prompts to select an entry when no highlight is measured', () => {
  const markup = render({ measurements: { status: 'no-selection' } })
  assert.match(markup, /Select an entry with a highlight to see its current position\./)
  assert.doesNotMatch(markup, /Selected highlight/)
})

test('explains a missing page size and blocks numeric edits rather than silently ignoring them', () => {
  const markup = render({ measurements: { status: 'no-page-size' } })

  assert.match(markup, /This page has no recorded size/)
  assert.doesNotMatch(markup, /Select an entry with a highlight/)
  assert.match(markup, /<button[^>]*disabled[^>]*>Apply<\/button>/)
})

// HT-C-011
test('offers an all keep entries scope', () => {
  const markup = render()
  assert.match(markup, /<option value="keep">All keep entries<\/option>/)
})

// HT-C-012
test('explains that keep scope spans the document while others stay on the page', () => {
  assert.match(render({ scope: 'keep' }), /Keep entries are matched across the whole document\./)
  assert.match(render({ scope: 'entry' }), /Only highlights on the page in view are affected\./)
})
