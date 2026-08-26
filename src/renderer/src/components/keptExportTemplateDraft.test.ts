import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyTextStyle,
  createDefaultKeptExportTemplateDraft,
  createKeptExportColumn,
  setSeparateLaterPages,
  updateDraftTemplate,
  validateKeptExportTemplateDraft
} from './keptExportTemplateDraft'

test('creates the financial table default with twenty entries per page', () => {
  const draft = createDefaultKeptExportTemplateDraft()

  assert.equal(draft.useSeparateLaterPages, false)
  assert.equal(draft.pageOneTemplate.layoutMode, 'table-row')
  assert.equal(draft.pageOneTemplate.entriesPerPage, 20)
  assert.deepEqual(
    draft.pageOneTemplate.columns.map((column) => column.sourceField),
    ['payee', 'money-out', 'money-in', 'balance']
  )
  assert.deepEqual(validateKeptExportTemplateDraft(draft), [])
})

test('creates an independent later-pages template when separation is enabled', () => {
  const original = createDefaultKeptExportTemplateDraft()
  const separate = setSeparateLaterPages(original, true)
  const changed = updateDraftTemplate(separate, 'later-pages', (template) => ({
    ...template,
    entriesPerPage: 30,
    columns: template.columns.map((column) => ({ ...column }))
  }))

  changed.laterPagesTemplate.columns[0]!.name = 'Later payee'

  assert.equal(changed.pageOneTemplate.entriesPerPage, 20)
  assert.equal(changed.laterPagesTemplate.entriesPerPage, 30)
  assert.equal(changed.pageOneTemplate.columns[0]?.name, 'Payee')
})

test('applies text style to every column or only the selected column', () => {
  const template = createDefaultKeptExportTemplateDraft().pageOneTemplate
  const bold = {
    ...template.defaultTextStyle,
    fontSize: 14,
    fontWeight: 'bold' as const
  }
  const all = applyTextStyle(template, bold, true)
  const selected = applyTextStyle(template, bold, false, 'money-in')

  assert.ok(all.columns.every((column) => column.textStyle?.fontSize === 14))
  assert.equal(selected.columns.find((column) => column.id === 'money-in')?.textStyle?.fontSize, 14)
  assert.equal(selected.columns.find((column) => column.id === 'payee')?.textStyle, undefined)
})

test('reports duplicate ids, invalid spacing, and columns outside the page', () => {
  const draft = createDefaultKeptExportTemplateDraft()
  draft.pageOneTemplate.columns = [
    { ...createKeptExportColumn(0, 'duplicate'), x: 600, width: 40, spacing: 0 },
    { ...createKeptExportColumn(1, 'duplicate') }
  ]

  const messages = validateKeptExportTemplateDraft(draft).map((issue) => issue.message)

  assert.ok(messages.some((message) => message.includes('fit inside the page')))
  assert.ok(messages.some((message) => message.includes('spacing must be positive')))
  assert.ok(messages.some((message) => message.includes('unique id')))
})
