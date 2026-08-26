import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import { RecentProjectsPanel } from './RecentProjectsPanel'

test('renders missing-source recovery controls and announces recovery status', () => {
  const markup = renderToStaticMarkup(
    <RecentProjectsPanel
      projects={[
        {
          id: 'project-1',
          name: 'Recovered project',
          path: 'project-1.json',
          updatedAt: '2026-08-18T00:00:00.000Z',
          availability: 'missing',
          missingSourceCount: 2
        }
      ]}
      saveState={{ status: 'saved' }}
      recoveryStatus="1 source recovered; 1 still missing."
      onOpen={() => undefined}
      onRemove={() => undefined}
      onLocateSources={() => undefined}
      onRetrySave={() => undefined}
    />
  )

  assert.match(markup, /2 missing sources/)
  assert.match(markup, /title="Locate missing source files"/)
  assert.match(markup, /role="status" aria-live="polite"/)
  assert.match(markup, /1 source recovered; 1 still missing\./)
})

test('shows at most five recent projects inline and offers access to the complete list', () => {
  const projects = Array.from({ length: 7 }, (_, index) => ({
    id: `project-${index + 1}`,
    name: `Project ${index + 1}`,
    path: `project-${index + 1}.json`,
    updatedAt: `2026-08-${String(21 - index).padStart(2, '0')}T00:00:00.000Z`,
    availability: 'available' as const,
    missingSourceCount: 0
  }))
  const markup = renderToStaticMarkup(
    <RecentProjectsPanel
      projects={projects}
      saveState={{ status: 'saved' }}
      recoveryStatus={null}
      onOpen={() => undefined}
      onRemove={() => undefined}
      onLocateSources={() => undefined}
      onRetrySave={() => undefined}
    />
  )

  assert.match(markup, /5 shown/)
  assert.match(markup, /View all 7/)
  assert.match(markup, /Project 5/)
  assert.doesNotMatch(markup, /Project 6/)
})
