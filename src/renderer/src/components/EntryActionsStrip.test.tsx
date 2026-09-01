import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EntryActionsStrip } from './EntryActionsStrip'

void React

test('does not offer a standalone search button from review mode', () => {
  const markup = renderToStaticMarkup(
    <EntryActionsStrip mode="review" onModeChange={() => undefined} onCommand={() => undefined} />
  )

  assert.doesNotMatch(markup, /aria-label="Open search and filters"/)
  assert.doesNotMatch(markup, />Search</)
  assert.match(markup, /aria-label="Review and bulk actions"/)
})

test('includes quick zoom actions in the right-side tool strip', () => {
  const markup = renderToStaticMarkup(
    <EntryActionsStrip mode="review" onModeChange={() => undefined} onCommand={() => undefined} />
  )

  assert.match(markup, /aria-label="Zoom out"/)
  assert.match(markup, /aria-label="Zoom in"/)
})

test('includes a project currency command in the quick tool strip', () => {
  const markup = renderToStaticMarkup(
    <EntryActionsStrip mode="review" onModeChange={() => undefined} onCommand={() => undefined} />
  )

  assert.match(markup, /aria-label="Project currency"/)
  assert.match(markup, /\$\/£/)
})
