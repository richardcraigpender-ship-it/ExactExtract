import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { KeptExportTemplateEditor } from './KeptExportTemplateEditor'
import { createDefaultKeptExportTemplateDraft } from './keptExportTemplateDraft'

void React

test('renders the complete default page-template editor without applying changes', () => {
  const markup = renderToStaticMarkup(
    <KeptExportTemplateEditor onApply={() => {}} onExport={() => {}} onCancel={() => {}} />
  )

  assert.match(markup, /Same template for every page/)
  assert.match(markup, /Separate Page 1 and later pages/)
  assert.match(markup, /role="tab" aria-selected="true">Page 1/)
  assert.match(markup, /role="tab" aria-selected="false" disabled="">Later pages/)
  assert.match(markup, /Table \/ row/)
  assert.match(markup, /Column fill/)
  assert.match(markup, /Entries per page/)
  assert.match(markup, /value="20"/)
  assert.match(markup, /Payee \/ description/)
  assert.match(markup, /Money out/)
  assert.match(markup, /Money in/)
  assert.match(markup, /Balance/)
  assert.match(markup, /Change all entries/)
  assert.match(markup, /Weight/)
  assert.match(markup, /Style/)
  assert.match(markup, /Page 1 background/)
  assert.match(markup, /Reset template/)
  assert.match(markup, /Reset all/)
  assert.match(markup, /Apply<\/button>/)
  assert.match(markup, /Export PDF/)

  const previewMarkup = renderToStaticMarkup(
    <KeptExportTemplateEditor onApply={() => {}} onExport={() => {}} onPreview={() => {}} />
  )
  assert.match(previewMarkup, />Preview<\/button>/)
})

test('labels balance snapshot totals separately from closing balances', () => {
  const markup = renderToStaticMarkup(
    <KeptExportTemplateEditor onApply={() => {}} onExport={() => {}} />
  )

  assert.match(markup, /Balance snapshot total/)
  assert.match(markup, /Calculated closing balance/)
  assert.match(markup, /Statement closing balance/)
  assert.match(markup, /sum of snapshots, not the account closing balance/)
})

test('disables apply and export and reports invalid PDF-point columns', () => {
  const draft = createDefaultKeptExportTemplateDraft()
  draft.pageOneTemplate.columns[0]!.x = 600
  draft.pageOneTemplate.columns[0]!.width = 100

  const markup = renderToStaticMarkup(
    <KeptExportTemplateEditor initialDraft={draft} onApply={() => {}} onExport={() => {}} />
  )

  assert.match(markup, /role="alert"/)
  assert.match(markup, /must fit inside the page/)
  assert.match(markup, /disabled=""[^>]*>.*Apply/)
  assert.match(markup, /disabled=""[^>]*>.*Export PDF/)
})
