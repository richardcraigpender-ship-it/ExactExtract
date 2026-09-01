import assert from 'node:assert/strict'
import test from 'node:test'

import { colourPaletteFromDividers, detectDividerStyles } from './dividers'

test('clusters visual rules into deterministic divider styles', () => {
  const clusters = detectDividerStyles([
    {
      pageNumber: 1,
      height: 792,
      visualRules: [
        {
          orientation: 'horizontal',
          x: 40,
          y: 600,
          length: 300,
          thickness: 0.8,
          colour: '#336699'
        },
        {
          orientation: 'horizontal',
          x: 40,
          y: 560,
          length: 280,
          thickness: 1.1,
          colour: '#336699'
        },
        { orientation: 'vertical', x: 40, y: 100, length: 500, thickness: 1, colour: '#101010' }
      ]
    },
    {
      pageNumber: 2,
      height: 792,
      visualRules: [
        { orientation: 'horizontal', x: 40, y: 620, length: 300, thickness: 1, colour: '#336699' }
      ]
    }
  ])

  assert.equal(clusters[0]?.orientation, 'horizontal')
  assert.equal(clusters[0]?.occurrenceCount, 3)
  assert.equal(clusters[0]?.averageLength, 293.3)
  assert.deepEqual(clusters[0]?.pageNumbers, [1, 2])
  assert.equal(clusters[0]?.colour?.hex, '#336699')
  assert.equal(clusters[0]?.likelyRole, 'table-rule')
  assert.equal(clusters[1]?.orientation, 'vertical')
})

test('builds a stable divider colour palette', () => {
  const palette = colourPaletteFromDividers([
    {
      id: 'horizontal|1.0|#336699|table-rule',
      orientation: 'horizontal',
      thickness: 1,
      averageLength: 300,
      colour: { hex: '#336699', name: 'Blue' },
      likelyRole: 'table-rule',
      occurrenceCount: 2,
      pageNumbers: [1]
    }
  ])

  assert.deepEqual(palette, [
    { hex: '#336699', name: 'Blue', occurrenceCount: 2, likelyRole: 'divider' }
  ])
})
