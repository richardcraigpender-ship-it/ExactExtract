import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import { RightWorkspace, type RightWorkspaceMode } from './RightWorkspace'

const contexts: Record<RightWorkspaceMode, React.ReactNode> = {
  review: <p>Bulk controls</p>,
  analysis: <p>Metrics</p>,
  export: <p>Export controls</p>,
  pages: <p>Page thumbnails</p>,
  warnings: <p>Warning details</p>,
  'remove-pages': <p>Remove pages</p>
}

test('keeps entries visible while exposing one accessible context panel', () => {
  const markup = renderToStaticMarkup(
    <RightWorkspace
      mode="analysis"
      entries={
        <ol>
          <li>Entry 1</li>
        </ol>
      }
      contexts={contexts}
      warningCount={3}
      onModeChange={() => {}}
      onCommand={() => {}}
    />
  )

  assert.match(markup, /aria-label="Extracted entries"/)
  assert.match(markup, /Entry 1/)
  assert.match(markup, /role="tab"[^>]*aria-label="Analysis"[^>]*aria-selected="true"/)
  assert.match(markup, /role="tabpanel"[^>]*aria-label="Analysis"/)
  assert.match(markup, />Metrics</)
  assert.doesNotMatch(markup, />Export controls</)
  assert.match(markup, /aria-label="3 warnings"/)
})

test('marks the highlight command pressed without relying on color', () => {
  const markup = renderToStaticMarkup(
    <RightWorkspace
      mode="review"
      entries={<p>Entries</p>}
      contexts={contexts}
      highlightsVisible={false}
      onModeChange={() => {}}
      onCommand={() => {}}
    />
  )

  assert.match(markup, /aria-label="Toggle source highlights"[^>]*aria-pressed="false"/)
})
