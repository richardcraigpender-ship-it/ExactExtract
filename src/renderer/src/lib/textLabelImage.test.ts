import assert from 'node:assert/strict'
import test from 'node:test'
import { renderTextLabelPng } from './textLabelImage'

test('returns undefined in non-browser env or on empty text', () => {
  assert.equal(renderTextLabelPng('', { fontSize: 10, color: '#000000' }), undefined)
  assert.equal(renderTextLabelPng('   ', { fontSize: 10, color: '#000000' }), undefined)
  assert.equal(
    renderTextLabelPng('£100.00', {
      fontSize: 10,
      color: '#000000',
      fontFamily: 'Consolas',
      fontWeight: '700',
      backgroundColor: '#fcfbfa'
    }),
    undefined
  )
})
