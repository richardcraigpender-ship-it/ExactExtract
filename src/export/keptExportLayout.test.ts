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

test('adds a configured divider after every rendered entry', () => {
  const current = template()
  current.useSeparateLaterPages = false
  current.pageOneTemplate.divider = {
    enabled: true,
    startX: 40,
    endX: 300,
    width: 260,
    thickness: 1.5,
    color: '#336699',
    opacity: 0.4
  }

  const plan = buildKeptExportRenderPlan(rows.slice(0, 2), current)

  assert.deepEqual(
    plan.pages[0]?.dividers.map((divider) => [
      divider.entryId,
      divider.startX,
      divider.endX,
      divider.thickness,
      divider.color,
      divider.opacity
    ]),
    [
      ['one', 40, 300, 1.5, '#336699', 0.4],
      ['two', 40, 300, 1.5, '#336699', 0.4]
    ]
  )
})

test('lifts dividers off the following entry by the configured spacing', () => {
  const current = template()
  current.useSeparateLaterPages = false
  const divider = {
    enabled: true,
    startX: 40,
    endX: 300,
    width: 260,
    thickness: 1.5,
    color: '#336699',
    opacity: 0.4
  }
  current.pageOneTemplate.divider = { ...divider }

  const flush = buildKeptExportRenderPlan(rows.slice(0, 2), current)
  const flushY = flush.pages[0]?.dividers.map((placement) => placement.y) ?? []

  current.pageOneTemplate.divider = { ...divider, spacing: 6 }
  const spaced = buildKeptExportRenderPlan(rows.slice(0, 2), current)

  assert.equal(flushY.length, 2)
  assert.deepEqual(
    spaced.pages[0]?.dividers.map((placement) => placement.y),
    flushY.map((y) => y - 6)
  )
})

test('renders references under the main text column when configured', () => {
  const current = template()
  current.useSeparateLaterPages = false
  current.pageOneTemplate.showReferenceUnderMainText = true
  const plan = buildKeptExportRenderPlan(
    [
      { entryId: 'one', values: { payee: 'One', reference: 'CARD-100' } },
      { entryId: 'two', values: { payee: 'Two' } }
    ],
    current
  )

  assert.deepEqual(
    plan.pages[0]?.placements.map((placement) => [
      placement.entryId,
      placement.columnId,
      placement.text
    ]),
    [
      ['one', 'payee', 'One'],
      ['two', 'payee', 'Two'],
      ['one', 'payee:reference', 'Ref: CARD-100']
    ]
  )
  const payee = plan.pages[0]?.placements.find((placement) => placement.columnId === 'payee')
  const reference = plan.pages[0]?.placements.find(
    (placement) => placement.columnId === 'payee:reference'
  )
  assert.equal(reference?.y, (payee?.y ?? 0) + (payee?.style.fontSize ?? 0) + 3)
  assert.equal(reference?.height, (reference?.style.fontSize ?? 0) + 3)
})

test('keeps a divider clear of the reference line beneath the payee', () => {
  const current = template()
  current.useSeparateLaterPages = false
  current.pageOneTemplate.showReferenceUnderMainText = true
  current.pageOneTemplate.divider = {
    enabled: true,
    startX: 40,
    endX: 300,
    width: 260,
    thickness: 1,
    color: '#336699',
    opacity: 0.4
  }

  const plan = buildKeptExportRenderPlan(
    [{ entryId: 'one', values: { payee: 'One', reference: 'CARD-100' } }],
    current
  )

  const reference = plan.pages[0]?.placements.find(
    (placement) => placement.columnId === 'payee:reference'
  )
  const divider = plan.pages[0]?.dividers[0]
  const referenceTextBottom = (reference?.y ?? 0) + (reference?.style.fontSize ?? 0)

  assert.ok((divider?.y ?? 0) >= referenceTextBottom + 3)
})
