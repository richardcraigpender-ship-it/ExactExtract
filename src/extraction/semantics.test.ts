import assert from 'node:assert/strict'
import test from 'node:test'

import { classifySemanticLines } from './semantics'
import type { ExtractedLine } from './types'

function line(id: string, text: string, height = 10): ExtractedLine {
  return {
    id,
    documentId: 'document-1',
    pageNumber: 1,
    blockIds: [`${id}:block`],
    text,
    bbox: { x: 40, y: 700, width: 300, height, coordinateSpace: 'pdf-points' },
    readingOrder: Number(id.slice(1))
  }
}

test('classifies headings, paragraphs, list items, and key-value lines', () => {
  const candidates = classifySemanticLines([
    line('l1', 'Quarterly Results', 16),
    line('l2', 'Revenue increased during the reporting period.'),
    line('l3', '- Operating income'),
    line('l4', 'Total revenue: $1,250')
  ])

  assert.deepEqual(
    candidates.map((candidate) => candidate.kind),
    ['heading', 'paragraph', 'list-item', 'key-value']
  )
  assert.deepEqual(candidates[3]?.blockIds, ['l4:block'])
})

test('structural prefixes take precedence over heading geometry', () => {
  const candidates = classifySemanticLines([
    line('l1', 'Notes', 10),
    line('l2', 'Account: Receivables', 20),
    line('l3', '1. Current assets', 20)
  ])

  assert.equal(candidates[1]?.kind, 'key-value')
  assert.equal(candidates[2]?.kind, 'list-item')
})

test('does not mutate caller-owned line block IDs', () => {
  const source = line('l1', 'SUMMARY')
  const candidate = classifySemanticLines([source])[0]
  candidate?.blockIds.push('new-block')

  assert.deepEqual(source.blockIds, ['l1:block'])
})
