import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import { SourcePdfPanel } from './SourcePdfPanel'

test('renders source PDFs with the active document identified', () => {
  const markup = renderToStaticMarkup(
    <SourcePdfPanel
      documents={[
        { path: 'C:/invoices/january.pdf', name: 'January.pdf', pageCount: 3 },
        { path: 'C:/invoices/february.pdf', name: 'February.pdf', pageCount: 8 }
      ]}
      activePath="C:/invoices/february.pdf"
      onSelect={() => {}}
      onAddPdfs={() => {}}
    />
  )

  assert.match(markup, /aria-label="Source PDF"/)
  assert.match(markup, /January\.pdf/)
  assert.match(markup, /February\.pdf/)
  assert.match(markup, /aria-pressed="true"/)
  assert.match(markup, /8 pages/)
  assert.match(markup, /Add PDFs/)
})

test('renders a usable empty source state', () => {
  const markup = renderToStaticMarkup(
    <SourcePdfPanel documents={[]} onSelect={() => {}} onAddPdfs={() => {}} />
  )

  assert.match(markup, /0 documents/)
  assert.match(markup, /No source PDFs are loaded\./)
})
