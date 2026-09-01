import assert from 'node:assert/strict'
import test from 'node:test'

import type { TextLayerPageInput } from '../extraction/types'
import { detectDocumentStyleProfile } from './detect'

function item(
  str: string,
  fontName: string | undefined,
  size: number,
  x: number,
  baseline: number,
  width = str.length * size * 0.45
): TextLayerPageInput['items'][number] {
  return {
    str,
    fontName,
    transform: [size, 0, 0, size, x, baseline],
    width,
    height: size,
    fontAscentRatio: 0.8
  }
}

function page(items: TextLayerPageInput['items'], pageNumber = 1): TextLayerPageInput {
  return {
    documentId: 'document-1',
    pageNumber,
    width: 612,
    height: 792,
    rotation: 0,
    items,
    imageObjectCount: 0
  }
}

test('clusters digital PDF text styles deterministically', () => {
  const profile = detectDocumentStyleProfile(
    'document-1',
    [
      page([
        item('Monthly Statement', 'ABCDEE+AcmeSans-Bold', 18, 72, 748),
        item('Account summary line one', 'ABCDEE+AcmeSans-Regular', 11, 72, 650),
        item('Account summary line two', 'ABCDEE+AcmeSans-Regular', 11, 72, 632)
      ])
    ],
    '2026-09-01T10:00:00.000Z'
  )

  assert.equal(profile.source, 'pdf-text')
  assert.equal(profile.confidence, 'high')
  assert.equal(profile.textStyles.length, 2)
  assert.deepEqual(
    profile.textStyles.map((cluster) => cluster.fontFamily),
    ['Acme Sans', 'Acme Sans']
  )
  assert.ok(profile.textStyles.some((cluster) => cluster.fontWeight === 'bold'))
})

test('infers body and header roles from frequency size and page position', () => {
  const profile = detectDocumentStyleProfile(
    'document-1',
    [
      page([
        item('Hospital Discharge Summary', 'HospitalSerif-Bold', 20, 72, 750),
        item(
          'Patient instruction text with enough characters',
          'HospitalSerif-Regular',
          11,
          72,
          650
        ),
        item('Follow up appointment information', 'HospitalSerif-Regular', 11, 72, 630),
        item('Confidential footer', 'HospitalSerif-Regular', 8, 72, 24)
      ])
    ],
    '2026-09-01T10:00:00.000Z'
  )

  assert.ok(profile.textStyles.some((cluster) => cluster.likelyRole === 'header'))
  assert.ok(profile.textStyles.some((cluster) => cluster.likelyRole === 'body'))
  assert.ok(profile.textStyles.some((cluster) => cluster.likelyRole === 'small-print'))
})

test('reports missing font metadata without failing detection', () => {
  const profile = detectDocumentStyleProfile(
    'document-1',
    [page([item('Readable text with no font', undefined, 12, 72, 650)])],
    '2026-09-01T10:00:00.000Z'
  )

  assert.equal(profile.textStyles[0]?.fontFamily, 'Unknown')
  assert.ok(profile.warnings.some((warning) => warning.code === 'missing-font-name'))
})

test('returns a partial image-only profile when no embedded text exists', () => {
  const profile = detectDocumentStyleProfile(
    'document-1',
    [{ ...page([], 1), imageObjectCount: 4 }],
    '2026-09-01T10:00:00.000Z'
  )

  assert.equal(profile.source, 'ocr-image')
  assert.equal(profile.confidence, 'low')
  assert.deepEqual(profile.textStyles, [])
  assert.ok(profile.warnings.some((warning) => warning.code === 'no-text'))
  assert.ok(profile.warnings.some((warning) => warning.code === 'image-only'))
})

test('keeps page summaries compact and sorted by page', () => {
  const profile = detectDocumentStyleProfile(
    'document-1',
    [
      page([item('Body one', 'Book-Regular', 10, 72, 650)], 1),
      page([item('Body two', 'Book-Regular', 10, 72, 650)], 2)
    ],
    '2026-09-01T10:00:00.000Z'
  )

  assert.deepEqual(
    profile.pageSummaries.map((summary) => summary.pageNumber),
    [1, 2]
  )
  assert.equal(profile.pageSummaries[0]?.textStyleClusterIds.length, 1)
})

test('includes divider styles and colour palette from visual rules', () => {
  const profile = detectDocumentStyleProfile(
    'document-1',
    [
      {
        ...page([item('Body one', 'Book-Regular', 10, 72, 650)], 1),
        visualRules: [
          {
            orientation: 'horizontal',
            x: 40,
            y: 600,
            length: 300,
            thickness: 1,
            colour: '#336699'
          },
          { orientation: 'horizontal', x: 40, y: 560, length: 300, thickness: 1, colour: '#336699' }
        ]
      }
    ],
    '2026-09-01T10:00:00.000Z'
  )

  assert.equal(profile.dividerStyles[0]?.orientation, 'horizontal')
  assert.equal(profile.dividerStyles[0]?.occurrenceCount, 2)
  assert.equal(profile.dividerStyles[0]?.colour?.hex, '#336699')
  assert.equal(profile.colourPalette[0]?.hex, '#336699')
  assert.equal(profile.colourPalette[0]?.likelyRole, 'divider')
})

test('warns when operator-list visual rules are unavailable', () => {
  const profile = detectDocumentStyleProfile(
    'document-1',
    [page([item('Body one', 'Book-Regular', 10, 72, 650)], 1)],
    '2026-09-01T10:00:00.000Z'
  )

  assert.ok(profile.warnings.some((warning) => warning.code === 'missing-operator-list'))
})
