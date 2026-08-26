import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import { HeaderBar } from './HeaderBar'

test('announces save status as an atomic polite status', () => {
  const markup = renderToStaticMarkup(
    <HeaderBar
      screen="workspace"
      theme="light"
      onBrandClick={() => undefined}
      onToggleTheme={() => undefined}
      onAddPdfs={() => undefined}
      onToggleShortcutsHelp={() => undefined}
      saveStatus="saving"
    />
  )

  assert.match(markup, /role="status" aria-live="polite" aria-atomic="true"/)
  assert.match(markup, />Saving\.\.\.<\/span>/)
})
