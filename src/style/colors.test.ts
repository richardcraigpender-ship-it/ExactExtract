import assert from 'node:assert/strict'
import test from 'node:test'

import { clusterColours, nearestColourName, normalizeHexColour, rgbToHex } from './colors'

test('normalizes RGB and hex colours deterministically', () => {
  assert.equal(rgbToHex(51, 102, 153), '#336699')
  assert.equal(normalizeHexColour('#369'), '#336699')
  assert.equal(normalizeHexColour('not-a-colour'), undefined)
})

test('assigns stable approximate colour names', () => {
  assert.equal(nearestColourName('#101010'), 'Black')
  assert.equal(nearestColourName('#335f99'), 'Blue')
})

test('clusters similar exact colours by normalized hex and role', () => {
  assert.deepEqual(
    clusterColours([
      { hex: '#336699', role: 'divider' },
      { hex: '#369', role: 'divider' },
      { hex: '#101010', role: 'text' },
      { role: 'unknown' }
    ]),
    [
      { hex: '#336699', name: 'Blue', occurrenceCount: 2, likelyRole: 'divider' },
      { hex: '#101010', name: 'Black', occurrenceCount: 1, likelyRole: 'text' }
    ]
  )
})
