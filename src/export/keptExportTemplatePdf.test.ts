import assert from 'node:assert/strict'
import zlib from 'node:zlib'
import test from 'node:test'

import { PROJECT_SCHEMA_VERSION, type ProjectEntry, type ProjectState } from '../shared/contracts'
import type { KeptExportTemplate, KeptExportPageTemplate } from '../shared/keptExportTemplate'
import { exportProjectKeptEntriesTemplatePdf } from './keptExportTemplatePdf'

function entry(id: string, text: string): ProjectEntry {
  return {
    id,
    rawText: text,
    normalizedText: text,
    source: 'parser',
    status: 'keep',
    confidence: 0.9,
    regions: [
      {
        documentId: 'document-1',
        pageNumber: 1,
        bbox: { x: 40, y: 600, width: 200, height: 20, coordinateSpace: 'pdf-points' }
      }
    ],
    tags: [],
    createdAt: '2026-08-30T09:00:00.000Z',
    updatedAt: '2026-08-30T09:00:00.000Z'
  }
}

function project(entries: ProjectEntry[]): ProjectState {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: 'project-1',
    name: 'Template export',
    createdAt: '2026-08-30T09:00:00.000Z',
    updatedAt: '2026-08-30T09:00:00.000Z',
    documents: [
      {
        id: 'document-1',
        path: 'source.pdf',
        name: 'source.pdf',
        size: 100,
        pageCount: 1,
        importedAt: '2026-08-30T09:00:00.000Z'
      }
    ],
    pages: [],
    entries,
    preflight: [],
    extractionJobs: [],
    auditTrail: [],
    settings: {
      theme: 'system',
      extraction: { mode: 'balanced', ocrLanguages: ['eng'] },
      splitPanePercent: 50,
      currencyCode: 'GBP'
    }
  }
}

function pageTemplate(): KeptExportPageTemplate {
  return {
    pageSize: 'a4',
    orientation: 'portrait',
    layoutMode: 'table-row',
    entriesPerPage: 20,
    defaultTextStyle: {
      fontRef: { kind: 'standard-14', family: 'Helvetica' },
      fontSize: 11,
      color: '#101010',
      fontWeight: 'normal',
      fontStyle: 'normal'
    },
    columns: [
      {
        id: 'column-text',
        name: 'Text',
        sourceField: 'text',
        x: 40,
        y: 60,
        width: 300,
        height: 16,
        spacing: 6,
        overflow: 'clip'
      }
    ]
  }
}

function template(): KeptExportTemplate {
  return {
    useSeparateLaterPages: false,
    pageOneTemplate: pageTemplate(),
    laterPagesTemplate: pageTemplate()
  }
}

function balanceColumnTemplate(sourceField: 'balance' | 'calculated-balance'): KeptExportTemplate {
  const page = pageTemplate()
  page.columns = [
    { ...page.columns[0] },
    {
      id: 'column-balance',
      name: 'Balance',
      sourceField,
      x: 360,
      y: 60,
      width: 120,
      height: 16,
      spacing: 6,
      overflow: 'clip'
    }
  ]
  return {
    useSeparateLaterPages: false,
    pageOneTemplate: page,
    laterPagesTemplate: page
  }
}

function referenceColumnTemplate(): KeptExportTemplate {
  const page = pageTemplate()
  page.columns = [
    { ...page.columns[0] },
    {
      id: 'column-reference',
      name: 'Reference',
      sourceField: 'reference',
      x: 360,
      y: 60,
      width: 160,
      height: 16,
      spacing: 6,
      overflow: 'clip'
    }
  ]
  return {
    useSeparateLaterPages: false,
    pageOneTemplate: page,
    laterPagesTemplate: page
  }
}

function decodePdfText(pdfBytes: Uint8Array): string {
  const raw = Buffer.from(pdfBytes)
  const streamBlocks = [...raw.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
  const content =
    streamBlocks.length === 0
      ? raw.toString('latin1')
      : streamBlocks
          .map((match) => {
            const buffer = Buffer.from(match[1], 'latin1')
            try {
              return zlib.inflateSync(buffer).toString('latin1')
            } catch {
              return buffer.toString('latin1')
            }
          })
          .join('\n')

  // pdf-lib writes drawn text as hex strings, so decode them back to readable characters.
  return content.replace(/<([\da-f]+)>/gi, (_, hex: string) =>
    Buffer.from(hex, 'hex').toString('latin1')
  )
}

test('renders kept entries that carry no financial amounts or dates', async () => {
  const bytes = await exportProjectKeptEntriesTemplatePdf(
    project([entry('entry-1', 'Consulting summary note'), entry('entry-2', 'Second plain row')]),
    template()
  )

  const text = decodePdfText(bytes)
  assert.match(text, /Consulting summary note/)
  assert.match(text, /Second plain row/)
})

test('still renders financial values for statement-shaped entries', async () => {
  const bytes = await exportProjectKeptEntriesTemplatePdf(
    project([entry('entry-1', '01/02/2026 Acme Water Bill 125.00')]),
    template()
  )

  assert.match(decodePdfText(bytes), /Acme Water Bill/)
})

test('renders a calculated balance column from the manual opening balance', async () => {
  const withBalance = balanceColumnTemplate('calculated-balance')
  withBalance.runningBalance = {
    enabled: true,
    openingBalance: 1000,
    fallback: 'first-existing-balance',
    balanceFieldMode: 'add-calculated',
    decimalPlaces: 2
  }

  const bytes = await exportProjectKeptEntriesTemplatePdf(
    project([entry('entry-1', '01/02/2026 Acme Water Bill 125.00')]),
    withBalance
  )

  assert.match(decodePdfText(bytes), /£875\.00/)
})

test('replace mode substitutes the original balance column with the calculated value', async () => {
  const replaceTemplate = balanceColumnTemplate('balance')
  replaceTemplate.runningBalance = {
    enabled: true,
    openingBalance: 500,
    fallback: 'first-existing-balance',
    balanceFieldMode: 'replace-original',
    decimalPlaces: 2
  }

  const bytes = await exportProjectKeptEntriesTemplatePdf(
    project([entry('entry-1', '01/02/2026 Acme Water Bill 125.00')]),
    replaceTemplate
  )

  assert.match(decodePdfText(bytes), /£375\.00/)
})

test('keeps the original balance column untouched in add-calculated mode', async () => {
  const keepTemplate = balanceColumnTemplate('balance')
  keepTemplate.runningBalance = {
    enabled: true,
    openingBalance: 9999,
    fallback: 'first-existing-balance',
    balanceFieldMode: 'add-calculated',
    decimalPlaces: 2
  }

  const bytes = await exportProjectKeptEntriesTemplatePdf(
    project([entry('entry-1', '01/02/2026 Acme Water Bill 125.00')]),
    keepTemplate
  )

  assert.doesNotMatch(decodePdfText(bytes), /9874\.00/)
})

test('text-only rows still render when the running balance is enabled', async () => {
  const withBalance = balanceColumnTemplate('calculated-balance')
  withBalance.runningBalance = {
    enabled: true,
    openingBalance: 250,
    fallback: 'first-existing-balance',
    balanceFieldMode: 'add-calculated',
    decimalPlaces: 2
  }

  const bytes = await exportProjectKeptEntriesTemplatePdf(
    project([entry('entry-1', 'Consulting summary note')]),
    withBalance
  )

  const text = decodePdfText(bytes)
  assert.match(text, /Consulting summary note/)
  assert.match(text, /£250\.00/)
})

test('renders a kept entry reference under the main text when configured', async () => {
  const withReference = template()
  withReference.pageOneTemplate.showReferenceUnderMainText = true
  const referencedEntry = entry('entry-1', 'Consulting summary note')
  referencedEntry.notes = 'CARD-100'

  const bytes = await exportProjectKeptEntriesTemplatePdf(project([referencedEntry]), withReference)

  const text = decodePdfText(bytes)
  assert.match(text, /Consulting summary note/)
  assert.match(text, /Ref: CARD-100/)
})

test('renders an inferred entry reference under the main text when notes are empty', async () => {
  const withReference = template()
  withReference.pageOneTemplate.showReferenceUnderMainText = true

  const bytes = await exportProjectKeptEntriesTemplatePdf(
    project([entry('entry-1', 'Consulting summary note Ref CARD-100')]),
    withReference
  )

  const text = decodePdfText(bytes)
  assert.match(text, /Consulting summary note Ref CARD-100/)
  assert.match(text, /Ref: CARD-100/)
})

test('renders a kept entry reference column when configured', async () => {
  const referencedEntry = entry('entry-1', 'Consulting summary note')
  referencedEntry.notes = 'CARD-100'

  const bytes = await exportProjectKeptEntriesTemplatePdf(
    project([referencedEntry]),
    referenceColumnTemplate()
  )

  const text = decodePdfText(bytes)
  assert.match(text, /Consulting summary note/)
  assert.match(text, /CARD-100/)
})

test('honours the configured decimal places for the calculated balance', async () => {
  const withBalance = balanceColumnTemplate('calculated-balance')
  withBalance.runningBalance = {
    enabled: true,
    openingBalance: 100,
    fallback: 'first-existing-balance',
    balanceFieldMode: 'add-calculated',
    decimalPlaces: 0
  }

  const bytes = await exportProjectKeptEntriesTemplatePdf(
    project([entry('entry-1', 'Plain note row')]),
    withBalance
  )

  const text = decodePdfText(bytes)
  assert.match(text, /£100/)
  assert.doesNotMatch(text, /£100\.00/)
})

test('exports without a running balance config and does not mutate entries', async () => {
  const entries = [entry('entry-1', '01/02/2026 Acme Water Bill 125.00')]
  const snapshot = structuredClone(entries)

  const bytes = await exportProjectKeptEntriesTemplatePdf(project(entries), template())

  assert.ok(bytes.length > 0)
  assert.deepEqual(entries, snapshot)
})

test('does not fail when the running balance is enabled with zero kept entries', async () => {
  const withBalance = balanceColumnTemplate('calculated-balance')
  withBalance.runningBalance = {
    enabled: true,
    fallback: 'first-existing-balance',
    balanceFieldMode: 'add-calculated',
    decimalPlaces: 2
  }

  const bytes = await exportProjectKeptEntriesTemplatePdf(project([]), withBalance)

  assert.ok(bytes.length > 0)
})
