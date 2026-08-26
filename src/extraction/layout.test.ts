import assert from 'node:assert/strict'
import test from 'node:test'

import { groupPageLines } from './layout'
import { detectTableCandidates } from './tables'
import { parseTextLayerPage } from './textLayer'
import type { ParsedPage, TableTemplate } from './types'

function tablePage(secondColumnX = 200): ParsedPage {
  return parseTextLayerPage({
    documentId: 'document-1',
    pageNumber: 1,
    width: 612,
    height: 792,
    rotation: 0,
    items: [
      { str: 'Item', transform: [1, 0, 0, 10, 40, 700], width: 30, height: 10 },
      { str: 'Amount', transform: [1, 0, 0, 10, 200, 700], width: 45, height: 10 },
      { str: 'Service', transform: [1, 0, 0, 10, 40, 680], width: 45, height: 10 },
      { str: '120', transform: [1, 0, 0, 10, secondColumnX, 680], width: 20, height: 10 }
    ]
  })
}

test('groups same-baseline blocks into ordered lines', () => {
  const lines = groupPageLines(tablePage())
  assert.equal(lines.length, 2)
  assert.equal(lines[0]?.text, 'Item Amount')
  assert.equal(lines[1]?.text, 'Service 120')
})

test('detects aligned rows and infers a header', () => {
  const page = tablePage()
  const tables = detectTableCandidates(page, groupPageLines(page))

  assert.equal(tables.length, 1)
  assert.equal(tables[0]?.columnCount, 2)
  assert.equal(tables[0]?.headerLineId, 'document-1:p1:l1')
})

test('rejects rows whose columns are not aligned', () => {
  const page = tablePage(260)
  assert.equal(detectTableCandidates(page, groupPageLines(page)).length, 0)
})

test('validates rows against a measured table template', () => {
  const page = parseTextLayerPage({
    documentId: 'document-1',
    pageNumber: 1,
    width: 612,
    height: 792,
    rotation: 0,
    items: [
      { str: 'Description', transform: [1, 0, 0, 10, 40, 700], width: 70, height: 10 },
      { str: 'Amount', transform: [1, 0, 0, 10, 200, 700], width: 45, height: 10 },
      { str: 'Service', transform: [1, 0, 0, 10, 40, 680], width: 45, height: 10 },
      { str: '$120.00', transform: [1, 0, 0, 10, 200, 680], width: 42, height: 10 },
      { str: 'Parts', transform: [1, 0, 0, 10, 40, 660], width: 30, height: 10 },
      { str: '$80.00', transform: [1, 0, 0, 10, 200, 660], width: 38, height: 10 }
    ]
  })
  const template: TableTemplate = {
    name: 'Expenses',
    headerLabels: ['Description', 'Amount'],
    topY: 705,
    bottomY: 650,
    columns: [
      { name: 'description', type: 'text', xStart: 30, xEnd: 150, required: true },
      { name: 'amount', type: 'currency', xStart: 170, xEnd: 260, required: true }
    ]
  }

  const tables = detectTableCandidates(page, groupPageLines(page), 12, template)

  assert.equal(tables.length, 1)
  assert.equal(tables[0]?.templateName, 'Expenses')
  assert.deepEqual(tables[0]?.validatedRowLineIds, ['document-1:p1:l2', 'document-1:p1:l3'])
})
