import assert from 'node:assert/strict'
import test from 'node:test'

import type { KeptExportSourceRow, KeptExportTemplate } from '../shared/keptExportTemplate'
import { buildKeptExportRenderPlan } from './keptExportLayout'

const style = {
  fontRef: { kind: 'standard-14' as const, family: 'Helvetica' as const },
  fontSize: 10,
  color: '#000000',
  fontWeight: 'normal' as const,
  fontStyle: 'normal' as const
}

function template(): KeptExportTemplate {
  return {
    useSeparateLaterPages: true,
    pageOneTemplate: {
      pageSize: 'letter',
      orientation: 'portrait',
      layoutMode: 'table-row',
      entriesPerPage: 2,
      defaultTextStyle: style,
      columns: [
        {
          id: 'payee',
          name: 'Payee',
          sourceField: 'payee',
          x: 48,
          y: 72,
          width: 200,
          height: 80,
          spacing: 30,
          overflow: 'next-page'
        }
      ]
    },
    laterPagesTemplate: {
      pageSize: 'a4',
      orientation: 'landscape',
      layoutMode: 'column-fill',
      entriesPerPage: 1,
      defaultTextStyle: style,
      columns: [
        {
          id: 'payee',
          name: 'Payee',
          sourceField: 'payee',
          x: 20,
          y: 20,
          width: 200,
          height: 80,
          spacing: 30,
          overflow: 'next-page'
        }
      ]
    }
  }
}

const rows: KeptExportSourceRow[] = [
  { entryId: 'one', values: { payee: 'One' } },
  { entryId: 'two', values: { payee: 'Two' } },
  { entryId: 'three', values: { payee: 'Three' } }
]

test('builds page-aware placements using each template capacity', () => {
  const plan = buildKeptExportRenderPlan(rows, template())
  assert.deepEqual(
    plan.pages.map((page) => [
      page.pageNumber,
      page.template.pageSize,
      page.placements.map((item) => item.entryId)
    ]),
    [
      [1, 'letter', ['one', 'two']],
      [2, 'a4', ['three']]
    ]
  )
  assert.equal(plan.warnings.length, 0)
})

test('reports missing values and placement overflow', () => {
  const current = template()
  current.pageOneTemplate.columns[0]!.height = 20
  const plan = buildKeptExportRenderPlan([{ entryId: 'missing', values: {} }], current)
  assert.equal(
    plan.warnings.some((warning) => warning.code === 'missing-value'),
    true
  )
  assert.equal(
    plan.warnings.some((warning) => warning.code === 'overflow'),
    false
  )
})

test('fills between Start Y and End Y before continuing to the next page', () => {
  const current = template()
  current.useSeparateLaterPages = false
  current.pageOneTemplate.entriesPerPage = 20
  current.pageOneTemplate.fillBetweenY = true
  current.pageOneTemplate.startY = 60
  current.pageOneTemplate.endY = 120
  current.pageOneTemplate.columns[0]!.spacing = 30
  const plan = buildKeptExportRenderPlan(rows, current)

  assert.deepEqual(
    plan.pages.map((page) => page.placements.map((placement) => [placement.entryId, placement.y])),
    [
      [
        ['one', 60],
        ['two', 90]
      ],
      [['three', 60]]
    ]
  )
})
