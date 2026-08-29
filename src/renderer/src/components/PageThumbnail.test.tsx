import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import { PageThumbnail, PAGE_THUMBNAIL_ASPECT_RATIO } from './PageThumbnail'
import { PagePreviewStrip } from './PagePreviewStrip'

const bytes = (length = 8): Uint8Array => new Uint8Array(length).fill(37)

// PT-A-001
test('keeps the page number visible when no PDF data is available', () => {
  const markup = renderToStaticMarkup(<PageThumbnail data={null} pageNumber={4} />)

  assert.match(markup, /data-state="empty"/)
  assert.match(markup, /page-thumbnail-label">4</)
})

// PT-A-002
test('treats zero-length PDF data as missing rather than rendering a document', () => {
  const markup = renderToStaticMarkup(<PageThumbnail data={new Uint8Array()} pageNumber={2} />)
  assert.match(markup, /data-state="empty"/)
})

// PT-A-003
test('keeps the page number visible while the page is still loading', () => {
  const markup = renderToStaticMarkup(<PageThumbnail data={bytes()} pageNumber={7} />)

  assert.match(markup, /data-state="loading"/)
  assert.match(markup, /page-thumbnail-label">7</)
})

// PT-A-004
test('reserves a stable box so loading cannot resize the panel', () => {
  const markup = renderToStaticMarkup(<PageThumbnail data={bytes()} pageNumber={1} />)

  assert.match(markup, /width:96px/)
  assert.match(markup, new RegExp(`aspect-ratio:${PAGE_THUMBNAIL_ASPECT_RATIO}`))
})

// PT-A-005
test('honours an explicit width and a known page aspect ratio', () => {
  const markup = renderToStaticMarkup(
    <PageThumbnail data={bytes()} pageNumber={1} width={140} aspectRatio={1.5} />
  )

  assert.match(markup, /width:140px/)
  assert.match(markup, /aspect-ratio:1\.5/)
})

// PT-A-006
test('renders the supplied thumbnail for every page button', () => {
  const rendered: number[] = []
  const markup = renderToStaticMarkup(
    <PagePreviewStrip
      pageCount={3}
      currentPage={2}
      onSelectPage={() => {}}
      renderThumbnail={(pageNumber) => {
        rendered.push(pageNumber)
        return <PageThumbnail data={bytes()} pageNumber={pageNumber} />
      }}
    />
  )

  assert.deepEqual(rendered, [1, 2, 3])
  assert.match(markup, /aria-label="Go to page 2"[^>]*aria-current="page"/)
  assert.equal(markup.match(/page-thumbnail-label/g)?.length, 3)
})

// PT-A-007
test('falls back to a plain page number when no thumbnail renderer is supplied', () => {
  const markup = renderToStaticMarkup(
    <PagePreviewStrip pageCount={2} currentPage={1} onSelectPage={() => {}} />
  )

  assert.doesNotMatch(markup, /page-thumbnail-label/)
  assert.doesNotMatch(markup, /is-rendered/)
  assert.match(markup, /aria-label="Go to page 1"/)
})

// PT-A-008
test('marks the thumbnail slot as rendered so it can drop its placeholder shape', () => {
  const markup = renderToStaticMarkup(
    <PagePreviewStrip
      pageCount={1}
      currentPage={1}
      onSelectPage={() => {}}
      renderThumbnail={(pageNumber) => <PageThumbnail data={bytes()} pageNumber={pageNumber} />}
    />
  )

  assert.match(markup, /page-preview-thumbnail is-rendered/)
})

// PT-A-009
test('shows accessible per-page review counts beneath the preview', () => {
  const markup = renderToStaticMarkup(
    <PagePreviewStrip
      pageCount={2}
      currentPage={1}
      onSelectPage={() => {}}
      pageReviewCounts={new Map([[1, { keep: 3, maybe: 1, exclude: 2 }]])}
    />
  )

  assert.match(markup, /page-preview-count-keep">K: 3/)
  assert.match(markup, /page-preview-count-maybe">M: 1/)
  assert.match(markup, /page-preview-count-exclude">X: 2/)
  assert.match(markup, /aria-label="Go to page 1" aria-description="3 kept, 1 maybe, 2 excluded"/)
  assert.match(markup, /aria-label="Go to page 2" aria-description="0 kept, 0 maybe, 0 excluded"/)
})

// PT-A-010
test('hides thumbnails from assistive technology because the button is already labelled', () => {
  const markup = renderToStaticMarkup(
    <PagePreviewStrip
      pageCount={1}
      currentPage={1}
      onSelectPage={() => {}}
      renderThumbnail={(pageNumber) => <PageThumbnail data={bytes()} pageNumber={pageNumber} />}
    />
  )

  assert.match(markup, /aria-hidden="true"/)
  assert.match(markup, /aria-label="Go to page 1"/)
})

// PT-A-011
test('prefers an explicitly supplied page shape over the portrait default', () => {
  const landscape = renderToStaticMarkup(
    <PageThumbnail data={bytes()} pageNumber={1} aspectRatio={1.415} />
  )
  const fallback = renderToStaticMarkup(<PageThumbnail data={bytes()} pageNumber={1} />)

  assert.match(landscape, /aspect-ratio:1\.415/)
  assert.match(fallback, new RegExp(`aspect-ratio:${PAGE_THUMBNAIL_ASPECT_RATIO}`))
})

// PT-A-010
test('reports an empty page state', () => {
  const markup = renderToStaticMarkup(
    <PagePreviewStrip pageCount={0} currentPage={1} onSelectPage={() => {}} />
  )

  assert.match(markup, /No pages available\./)
  assert.doesNotMatch(markup, /Go to page/)
})
