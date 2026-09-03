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
  assert.match(markup, /Maximum entries per page/)
  assert.match(markup, /Fill between Start Y and End Y/)
  assert.match(markup, /Show references under main text/)
  assert.match(markup, /Entry divider/)
  assert.match(markup, /Show dividers/)
  assert.match(markup, /Calculated balance/)
  assert.match(markup, /Add calculated running balance/)
  assert.match(markup, /Opening balance/)
  assert.match(markup, /Decimal places/)
  assert.match(markup, /Width \(pt\)/)
  assert.match(markup, /Thickness \(pt\)/)
  assert.match(markup, /Start X \(pt\)/)
  assert.match(markup, /End X \(pt\)/)
  assert.match(markup, /Start Y \(pt\)/)
  assert.match(markup, /End Y \(pt\)/)
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

test('offers calculated balance as a column source and keeps controls off by default', () => {
  const markup = renderToStaticMarkup(
    <KeptExportTemplateEditor onApply={() => {}} onExport={() => {}} />
  )

  assert.match(markup, /<option value="reference">Reference<\/option>/)
  assert.match(markup, /<option value="calculated-balance">Calculated balance<\/option>/)
  assert.match(markup, /Keep original balance/)
  assert.match(markup, /Replace Balance columns/)
  assert.match(markup, /Add calculated balance field/)
  assert.match(markup, /Use first detected balance/)
  assert.match(markup, /Start from zero/)
})

test('blocks apply and export when the running balance inputs are invalid', () => {
  const draft = createDefaultKeptExportTemplateDraft()
  draft.runningBalance.enabled = true
  draft.runningBalance.decimalPlaces = 9

  const markup = renderToStaticMarkup(
    <KeptExportTemplateEditor initialDraft={draft} onApply={() => {}} onExport={() => {}} />
  )

  assert.match(markup, /decimal places must be a whole number from 0 to 6/)
  assert.match(markup, /disabled=""[^>]*>.*Apply/)
  assert.match(markup, /disabled=""[^>]*>.*Export PDF/)
})

test('accepts a blank opening balance as valid', () => {
  const draft = createDefaultKeptExportTemplateDraft()
  draft.runningBalance.enabled = true
  draft.runningBalance.openingBalance = undefined

  const markup = renderToStaticMarkup(
    <KeptExportTemplateEditor initialDraft={draft} onApply={() => {}} onExport={() => {}} />
  )

  assert.doesNotMatch(markup, /Opening balance must be a number/)
  assert.doesNotMatch(markup, /role="alert"/)
})

test('shows preview generation feedback while kept-text preview is running', () => {
  const markup = renderToStaticMarkup(
    <KeptExportTemplateEditor
      onApply={() => {}}
      onExport={() => {}}
      onPreview={() => {}}
      isPreviewing
    />
  )

  assert.match(markup, /Generating preview\.\.\./)
  assert.match(markup, /disabled=""[^>]*>Generating preview/)
  assert.match(markup, /disabled=""[^>]*>.*Export PDF/)
})

test('renders the page numbers section with matching disabled by default', () => {
  const markup = renderToStaticMarkup(
    <KeptExportTemplateEditor onApply={() => {}} onExport={() => {}} />
  )

  assert.match(markup, /Page numbers/)
  assert.match(markup, /Add page numbers/)
  assert.match(markup, /<option value="bottom-center"[^>]*>Bottom center<\/option>/)
  assert.match(markup, /<option value="top-left"[^>]*>Top left<\/option>/)
  assert.doesNotMatch(markup, /Match source page numbers/)
})

test('offers a detect action when onDetectPageNumbers is supplied', () => {
  const markup = renderToStaticMarkup(
    <KeptExportTemplateEditor
      onApply={() => {}}
      onExport={() => {}}
      onDetectPageNumbers={async () => undefined}
    />
  )

  assert.match(markup, /Match source page numbers/)
})

test('reports an invalid page number format that is missing the {n} placeholder', () => {
  const draft = createDefaultKeptExportTemplateDraft()
  draft.pageNumbers.enabled = true
  draft.pageNumbers.format.template = 'Page'

  const markup = renderToStaticMarkup(
    <KeptExportTemplateEditor initialDraft={draft} onApply={() => {}} onExport={() => {}} />
  )

  assert.match(markup, /needs a \{n\} placeholder/)
  assert.match(markup, /disabled=""[^>]*>.*Apply/)
})
