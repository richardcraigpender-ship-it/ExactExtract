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

test('recognizes common embedded font aliases without losing their face metadata', () => {
  assert.deepEqual(normalizePdfFontName('ArialMT-BoldItalic'), {
    sourceName: 'ArialMT-BoldItalic',
    fontFamily: 'Arial',
    fontFace: 'Bold Italic',
    fontWeight: 'bold',
    italic: true
  })
  assert.deepEqual(normalizePdfFontName('BCDEFG+Calibri-Light'), {
    sourceName: 'BCDEFG+Calibri-Light',
    fontFamily: 'Calibri',
    fontFace: undefined,
    fontWeight: 'unknown',
    italic: false
  })
  assert.equal(normalizePdfFontName('NotoSansCJK-Regular').fontFamily, 'Noto')
  assert.equal(normalizePdfFontName('HelveticaNeueLTStd-Roman').fontFamily, 'Helvetica')
})

test('recognizes wider office, Adobe, open-source, and international PDF font variants', () => {
  assert.equal(normalizePdfFontName('TimesNewRomanPS-BoldMT').fontFamily, 'Times New Roman')
  assert.equal(normalizePdfFontName('ABCDEE+ArialPSMT').fontFamily, 'Arial')
  assert.equal(normalizePdfFontName('AptosDisplay-Semibold').fontFamily, 'Aptos')
  assert.equal(normalizePdfFontName('AcuminPro-Regular').fontFamily, 'Myriad')
  assert.equal(normalizePdfFontName('FiraCode-Regular').fontFamily, 'Inter')
  assert.equal(normalizePdfFontName('NotoNaskhArabic-Regular').fontFamily, 'Noto')
  assert.equal(normalizePdfFontName('YuGothic-W01').fontFamily, 'CJK system font')
})

test('derives font size from the text transform and buckets to half points', () => {
  assert.equal(approximateFontSize([12, 0, 0, 11.8, 72, 700], 9), 11.8)
  assert.equal(fontSizeBucket(11.8), 12)
  assert.equal(fontSizeBucket(10.2), 10)
})
