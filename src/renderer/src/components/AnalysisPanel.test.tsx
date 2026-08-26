import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

void React

import type { ProjectEntry } from '../../../shared/contracts'
import { navigateToAnalysisIssue } from '../../../analysis'
import { AnalysisPanel } from './AnalysisPanel'

function entry(
  id: string,
  status: ProjectEntry['status'],
  numericValue: number,
  confidence = 0.95
): ProjectEntry {
  const timestamp = '2026-08-16T00:00:00.000Z'
  return {
    id,
    rawText: String(numericValue),
    normalizedText: String(numericValue),
    numericValue,
    source: 'parser',
    status,
    confidence,
    regions: [{ documentId: 'document', pageNumber: 1 }],
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

test('renders real kept-only metrics and explicit review counts', () => {
  const markup = renderToStaticMarkup(
    <AnalysisPanel
      entries={[
        entry('keep-a', 'keep', 10),
        entry('keep-b', 'keep', 20),
        entry('maybe', 'maybe', 500),
        entry('exclude', 'exclude', 1000)
      ]}
    />
  )

  assert.match(markup, /KEPT-ONLY ANALYSIS/)
  assert.match(markup, /<strong>2<\/strong> kept/)
  assert.match(markup, /<strong>1<\/strong> maybe/)
  assert.match(markup, /<strong>1<\/strong> excluded/)
  assert.match(markup, /<span>sum<\/span><strong>30<\/strong>/)
  assert.doesNotMatch(markup, /1,500/)
})

test('renders validation issue controls and routes the first affected entry', () => {
  const markup = renderToStaticMarkup(
    <AnalysisPanel entries={[entry('low', 'keep', 5, 0.2)]} onNavigateToEntry={() => undefined} />
  )
  assert.match(markup, /low confidence/)
  assert.match(markup, /<button type="button">/)

  const navigated: string[] = []
  navigateToAnalysisIssue(['entry-b', 'entry-a'], (entryId) => navigated.push(entryId))
  assert.deepEqual(navigated, ['entry-b'])
})
