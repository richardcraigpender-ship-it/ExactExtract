import assert from 'node:assert/strict'
import test from 'node:test'

import { approximateFontSize, fontSizeBucket, normalizePdfFontName } from './fonts'

test('normalizes subset embedded PDF font names and detects weight and slant', () => {
  assert.deepEqual(normalizePdfFontName('ABCDEE+AcmeSans-SemiBoldItalic'), {
    sourceName: 'ABCDEE+AcmeSans-SemiBoldItalic',
    fontFamily: 'Acme Sans',
    fontFace: 'Semi Bold Italic',
    fontWeight: 'semibold',
    italic: true
  })
})

test('returns an unknown style for missing font names', () => {
  assert.deepEqual(normalizePdfFontName(undefined), {
    fontFamily: 'Unknown',
    fontWeight: 'unknown',
    italic: false
  })
})

test('derives font size from the text transform and buckets to half points', () => {
  assert.equal(approximateFontSize([12, 0, 0, 11.8, 72, 700], 9), 11.8)
  assert.equal(fontSizeBucket(11.8), 12)
  assert.equal(fontSizeBucket(10.2), 10)
})
