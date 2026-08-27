import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import { PagePreviewStrip } from './PagePreviewStrip'
import { PageThumbnail } from './PageThumbnail'
import { WorkspaceToolWindow } from './WorkspaceToolWindow'

test('renders a labelled modal tool window with an explicit close command', () => {
  const markup = renderToStaticMarkup(
    <WorkspaceToolWindow title="Zoom and rotate" onClose={() => {}}>
      <p>Zoom controls</p>
    </WorkspaceToolWindow>
  )

  assert.match(markup, /role="dialog"/)
  assert.match(markup, /aria-modal="true"/)
  assert.match(markup, /aria-label="Close Zoom and rotate"/)
  assert.match(markup, /Zoom controls/)
})

test('renders page commands horizontally with the current page exposed', () => {
  const markup = renderToStaticMarkup(
    <PagePreviewStrip pageCount={3} currentPage={2} onSelectPage={() => {}} />
  )

  assert.match(markup, /aria-label="Go to page 1"/)
  assert.match(markup, /aria-label="Go to page 2"[^>]*aria-current="page"/)
  assert.match(markup, /aria-label="Go to page 3"/)
})

test('renders one thumbnail for every page while preserving the page commands', () => {
  const renderedPages: number[] = []
  const markup = renderToStaticMarkup(
    <PagePreviewStrip
      pageCount={3}
      currentPage={1}
      onSelectPage={() => {}}
      renderThumbnail={(pageNumber) => {
        renderedPages.push(pageNumber)
        return <span data-testid={`thumbnail-${pageNumber}`}>Preview {pageNumber}</span>
      }}
    />
  )

  assert.deepEqual(renderedPages, [1, 2, 3])
  assert.equal((markup.match(/data-testid="thumbnail-/g) ?? []).length, 3)
  assert.equal((markup.match(/page-preview-thumbnail is-rendered/g) ?? []).length, 3)
  assert.match(markup, /aria-label="Go to page 1"[^>]*aria-current="page"/)
})

test('renders an accessible empty state when the source has no pages', () => {
  const markup = renderToStaticMarkup(
    <PagePreviewStrip pageCount={0} currentPage={1} onSelectPage={() => {}} />
  )

  assert.match(markup, /aria-label="Page previewer"/)
  assert.match(markup, /No pages available\./)
  assert.doesNotMatch(markup, /aria-label="Go to page/)
})

test('keeps missing-data thumbnails visible without creating a PDF viewer', () => {
  const markup = renderToStaticMarkup(<PageThumbnail data={null} pageNumber={4} />)

  assert.match(markup, /class="page-thumbnail"/)
  assert.match(markup, /data-state="empty"/)
  assert.match(markup, />4<\/(?:span|div)>/)
  assert.doesNotMatch(markup, /react-pdf__Document|react-pdf__Page|canvas/)
})
