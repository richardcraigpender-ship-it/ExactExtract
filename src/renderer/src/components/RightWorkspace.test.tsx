import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import { RightWorkspace, type RightWorkspaceMode } from './RightWorkspace'

const contexts: Record<RightWorkspaceMode, React.ReactNode> = {
  'source-pdf': <p>Source documents</p>,
  review: <p>Bulk controls</p>,
  analysis: <p>Metrics</p>,
  export: <p>Export controls</p>,
  style: <p>Style profile</p>,
  pages: <p>Page thumbnails</p>,
  warnings: <p>Warning details</p>,
  'remove-pages': <p>Remove pages</p>,
  marks: <p>Highlight tools</p>,
  references: <p>Reference tools</p>,
  merchants: <p>Merchant library</p>,
  report: <p>Extraction report</p>
}

test('separates full-height tools from the extracted entries panel', () => {
  const markup = renderToStaticMarkup(
    <RightWorkspace
      mode="analysis"
      reviewControls={<p>Persistent review controls</p>}
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

  assert.match(markup, /class="left-workspace" aria-label="Workspace tools"/)
  assert.match(markup, /class="persistent-review-controls" aria-label="Review controls"/)
  assert.match(markup, /Persistent review controls/)
  assert.match(markup, /class="right-workspace" aria-label="Extracted entries"/)
  assert.match(markup, /Entry 1/)
  assert.match(markup, /role="tab"[^>]*aria-label="Analysis"[^>]*aria-selected="true"/)
  assert.match(markup, /role="tabpanel"[^>]*aria-label="Analysis"/)
  assert.match(markup, />Metrics</)
  assert.doesNotMatch(markup, />Export controls</)
  assert.match(markup, /aria-label="3 warnings"/)
})

test('signals hidden highlights on the marks tool without relying on color', () => {
  const markup = renderToStaticMarkup(
    <RightWorkspace
      mode="review"
      reviewControls={<p>Persistent review controls</p>}
      entries={<p>Entries</p>}
      contexts={contexts}
      highlightsVisible={false}
      onModeChange={() => {}}
      onCommand={() => {}}
    />
  )

  assert.match(markup, /role="tab"[^>]*aria-label="Highlight tools \(highlights hidden\)"/)
  // The tab is the only Marks control; there is no duplicate quick command.
  assert.doesNotMatch(markup, /aria-label="Open highlight tools"/)
})

test('exposes exactly one Marks control in the strip', () => {
  const markup = renderToStaticMarkup(
    <RightWorkspace
      mode="review"
      reviewControls={<p>Persistent review controls</p>}
      entries={<p>Entries</p>}
      contexts={contexts}
      onModeChange={() => {}}
      onCommand={() => {}}
    />
  )

  assert.equal(markup.match(/>Marks</g)?.length, 1)
})

test('opens the marks context panel when that tool is selected', () => {
  const markup = renderToStaticMarkup(
    <RightWorkspace
      mode="marks"
      reviewControls={<p>Persistent review controls</p>}
      entries={<p>Entries</p>}
      contexts={contexts}
      onModeChange={() => {}}
      onCommand={() => {}}
    />
  )

  assert.match(markup, /role="tabpanel"[^>]*aria-label="Highlight tools"/)
  assert.match(markup, />Highlight tools</)
})
