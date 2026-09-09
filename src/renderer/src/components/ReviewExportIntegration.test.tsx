import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseSplitParts } from '../../../review/operations'

void React

import type { ExportSnapshot } from '../../../export'
import type { ProjectEntry } from '../../../shared/contracts'
import { ExportPanel } from './ExportPanel'
import {
  createDefaultKeptExportTemplateDraft,
  toKeptExportTemplate
} from './keptExportTemplateDraft'
import { ReviewMergeSplitControls } from './ReviewMergeSplitControls'

function entry(id: string, status: ProjectEntry['status']): ProjectEntry {
  return {
    id,
    rawText: id,
    normalizedText: id,
    source: 'parser',
    status,
    confidence: 0.9,
    regions: [{ documentId: 'document-1', pageNumber: 1 }],
    tags: [],
    createdAt: '2026-08-16T10:00:00.000Z',
    updatedAt: '2026-08-16T10:00:00.000Z'
  }
}

const snapshot: ExportSnapshot = {
  exportSchemaVersion: 1,
  project: {
    id: 'project-1',
    name: 'Review project',
    schemaVersion: 1,
    createdAt: '2026-08-16T10:00:00.000Z',
    updatedAt: '2026-08-16T11:00:00.000Z',
    currencyCode: 'GBP'
  },
  documents: [
    {
      id: 'document-1',
      name: 'source.pdf',
      size: 100,
      importedAt: '2026-08-16T10:00:00.000Z',
      pageCount: 1
    }
  ],
  sections: { kept: [], maybe: [] },
  summary: { documentCount: 1, keptCount: 0, maybeCount: 0, excludedCount: 0 }
}

test('renders CSV, JSON, and PNG save commands with preview status', () => {
  const markup = renderToStaticMarkup(
    <ExportPanel
      snapshot={snapshot}
      status="Ready to export"
      isSaving={false}
      onSave={() => {}}
      onPreview={async () => new Uint8Array()}
    />
  )

  assert.match(markup, /Save kept entry PNGs/)
  assert.match(markup, /Save CSV/)
  assert.match(markup, /Save JSON/)
  assert.match(markup, /Preview PDF/)
  assert.match(markup, /Data exports/)
  assert.match(markup, /Layout &amp; PDF studio/)
  assert.doesNotMatch(markup, /More PDF formats/)
  assert.match(markup, /Ready to export/)
  assert.match(markup, /Review project/)
})

test('shows currency symbols for numeric kept entries in the export preview', () => {
  const keptSnapshot: ExportSnapshot = {
    ...snapshot,
    sections: {
      kept: [
        {
          id: 'entry-1',
          rawText: '125',
          normalizedText: '$125.00',
          numericValue: 125,
          source: 'parser',
          status: 'keep',
          confidence: 0.9,
          regions: [{ documentId: 'document-1', pageNumber: 1 }],
          tags: [],
          createdAt: '2026-08-16T10:00:00.000Z',
          updatedAt: '2026-08-16T10:00:00.000Z'
        }
      ],
      maybe: []
    },
    summary: { documentCount: 1, keptCount: 1, maybeCount: 0, excludedCount: 0 }
  }

  const markup = renderToStaticMarkup(
    <ExportPanel
      snapshot={keptSnapshot}
      status="Ready to export"
      isSaving={false}
      onSave={() => {}}
    />
  )

  assert.match(markup, /\$125\.00/)
})

test('offers the kept text template preview only once a template is configured', () => {
  const withoutTemplate = renderToStaticMarkup(
    <ExportPanel
      snapshot={snapshot}
      status="Ready to export"
      isSaving={false}
      onSave={() => {}}
      onPreview={async () => new Uint8Array()}
    />
  )

  assert.match(withoutTemplate, /<option value="pdf-kept-template" disabled="">/)

  const withTemplate = renderToStaticMarkup(
    <ExportPanel
      snapshot={snapshot}
      status="Ready to export"
      isSaving={false}
      onSave={() => {}}
      onPreview={async () => new Uint8Array()}
      keptExportTemplate={toKeptExportTemplate(createDefaultKeptExportTemplateDraft())}
    />
  )

  assert.match(withTemplate, /<option value="pdf-kept-template">Kept text template<\/option>/)
})

test('routes both studio modes into the unified canvas window', () => {
  const markup = renderToStaticMarkup(
    <ExportPanel
      snapshot={{ ...snapshot, summary: { ...snapshot.summary, keptCount: 1 } }}
      status="Ready to export"
      isSaving={false}
      onSave={() => {}}
      keptEntries={[entry('entry-1', 'keep')]}
      onOpenKeptTextCanvas={() => {}}
      onOpenKeptCanvas={() => {}}
    />
  )

  assert.match(markup, /Formatted PDF Statement/)
  assert.match(markup, /PNG Snippet Board/)
})

test('marks the selected export preview entry and offers it as a review-navigation target', () => {
  const keptSnapshot: ExportSnapshot = {
    ...snapshot,
    sections: {
      kept: [
        {
          id: 'entry-1',
          rawText: 'First kept row',
          normalizedText: 'First kept row',
          source: 'parser',
          status: 'keep',
          confidence: 0.9,
          regions: [{ documentId: 'document-1', pageNumber: 1 }],
          tags: [],
          createdAt: '2026-08-16T10:00:00.000Z',
          updatedAt: '2026-08-16T10:00:00.000Z'
        },
        {
          id: 'entry-2',
          rawText: 'Second kept row',
          normalizedText: 'Second kept row',
          source: 'parser',
          status: 'keep',
          confidence: 0.9,
          regions: [{ documentId: 'document-1', pageNumber: 1 }],
          tags: [],
          createdAt: '2026-08-16T10:00:00.000Z',
          updatedAt: '2026-08-16T10:00:00.000Z'
        }
      ],
      maybe: []
    },
    summary: { documentCount: 1, keptCount: 2, maybeCount: 0, excludedCount: 0 }
  }

  const withoutSelection = renderToStaticMarkup(
    <ExportPanel
      snapshot={keptSnapshot}
      status="Ready to export"
      isSaving={false}
      onSave={() => {}}
    />
  )
  assert.doesNotMatch(
    withoutSelection,
    /export-preview-jump/,
    'no jump button renders without a selection handler'
  )

  const withSelection = renderToStaticMarkup(
    <ExportPanel
      snapshot={keptSnapshot}
      status="Ready to export"
      isSaving={false}
      onSave={() => {}}
      selectedEntryId="entry-2"
      onSelectEntry={() => {}}
    />
  )
  assert.match(
    withSelection,
    /export-preview-jump/,
    'a jump button renders once a selection handler is provided'
  )
  assert.match(
    withSelection,
    /export-preview-entry is-selected/,
    'the matching entry is marked selected'
  )
  assert.match(
    withSelection,
    /export-preview-jump[^>]*aria-pressed="true"/,
    'the jump button for the selected entry reflects the pressed state'
  )
})

test('enables merge only for multiple same-status entries', () => {
  const enabled = renderToStaticMarkup(
    <ReviewMergeSplitControls
      selectedEntries={[entry('a', 'keep'), entry('b', 'keep')]}
      onMerge={() => {}}
      onSplit={() => {}}
    />
  )
  const disabled = renderToStaticMarkup(
    <ReviewMergeSplitControls
      selectedEntries={[entry('a', 'keep'), entry('b', 'maybe')]}
      onMerge={() => {}}
      onSplit={() => {}}
    />
  )

  assert.match(enabled, /Merge/)
  assert.doesNotMatch(enabled, /disabled=""[^>]*>.*Merge/)
  assert.match(disabled, /disabled=""/)
})

test('enables split for the primary clicked entry without checkbox selection', () => {
  const markup = renderToStaticMarkup(
    <ReviewMergeSplitControls
      selectedEntries={[]}
      primaryEntry={entry('primary', 'keep')}
      onMerge={() => {}}
      onSplit={() => {}}
    />
  )

  assert.doesNotMatch(markup, /title="Select an entry to split"[^>]*disabled=""/)
  assert.match(markup, /Split/)
})

test('parses split parts from new lines, semicolons, and vertical bars', () => {
  assert.deepEqual(parseSplitParts('Alpha\nBeta; Gamma | Delta'), [
    'Alpha',
    'Beta',
    'Gamma',
    'Delta'
  ])
})
