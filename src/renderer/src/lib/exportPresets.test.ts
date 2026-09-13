import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyExportPresetToDraft,
  EXPORT_PRESETS,
  type TextExportPresetId
} from './exportPresets'
import { createDefaultKeptExportTemplateDraft } from '../components/keptExportTemplateDraft'

test('documents exactly the three presets with distinct field/crop behavior', () => {
  assert.deepEqual(
    EXPORT_PRESETS.map((preset) => preset.id),
    ['clean-statement', 'source-faithful', 'image-archive']
  )
  const cleanStatement = EXPORT_PRESETS.find((preset) => preset.id === 'clean-statement')!
  const sourceFaithful = EXPORT_PRESETS.find((preset) => preset.id === 'source-faithful')!
  const imageArchive = EXPORT_PRESETS.find((preset) => preset.id === 'image-archive')!

  assert.equal(cleanStatement.includesReferences, false)
  assert.equal(sourceFaithful.includesReferences, true)
  assert.equal(imageArchive.includesSourceCrops, true)
  assert.equal(cleanStatement.includesSourceCrops, false)
})

test('clean statement turns the reference line off without touching other template fields', () => {
  const base = createDefaultKeptExportTemplateDraft()
  base.pageOneTemplate.defaultTextStyle.fontSize = 13

  const result = applyExportPresetToDraft('clean-statement' as TextExportPresetId, base)

  assert.equal(result.pageOneTemplate.showReferenceUnderMainText, false)
  assert.equal(result.laterPagesTemplate.showReferenceUnderMainText, false)
  assert.equal(result.pageOneTemplate.defaultTextStyle.fontSize, 13)
})

test('source-faithful evidence keeps the reference line on', () => {
  const result = applyExportPresetToDraft('source-faithful')

  assert.equal(result.pageOneTemplate.showReferenceUnderMainText, true)
  assert.equal(result.laterPagesTemplate.showReferenceUnderMainText, true)
})

test('does not mutate the supplied base draft', () => {
  const base = createDefaultKeptExportTemplateDraft()
  base.pageOneTemplate.showReferenceUnderMainText = true

  applyExportPresetToDraft('clean-statement', base)

  assert.equal(base.pageOneTemplate.showReferenceUnderMainText, true)
})
