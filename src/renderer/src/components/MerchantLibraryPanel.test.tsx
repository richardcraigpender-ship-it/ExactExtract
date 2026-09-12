import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MerchantLibraryPanel } from './MerchantLibraryPanel'
import { filterMerchantRecords, isLikelyPersonal } from './merchantLibraryFilters'
import type { MerchantRecord } from '../../../shared/merchants'

void React

function record(overrides: Partial<MerchantRecord> = {}): MerchantRecord {
  return {
    id: 'merchant-1',
    canonicalDisplayName: 'Greenfield Coffee',
    normalizedKey: 'greenfield coffee',
    aliases: [],
    classification: 'merchant-candidate',
    classificationReasons: [],
    userOverride: false,
    recurring: false,
    forecastIncluded: false,
    occurrenceCount: 3,
    provenance: [],
    firstSeenAt: '2026-01-02T00:00:00.000Z',
    lastSeenAt: '2026-03-04T00:00:00.000Z',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-03-04T00:00:00.000Z',
    ...overrides
  }
}

const noop = (): void => {}

function render(props: Partial<React.ComponentProps<typeof MerchantLibraryPanel>> = {}): string {
  return renderToStaticMarkup(
    <MerchantLibraryPanel
      records={[]}
      onApprove={noop}
      onExclude={noop}
      onRestore={noop}
      onToggleForecast={noop}
      onUpdate={noop}
      onForget={noop}
      onCreate={noop}
      onMergeAlias={noop}
      onRescanProject={noop}
      {...props}
    />
  )
}

test('reports an honest empty state and the local-only privacy boundary', () => {
  const markup = render()

  assert.match(markup, /STORED LOCALLY ONLY/)
  assert.match(markup, /Nothing here is uploaded or shared/)
  assert.match(markup, /No merchants learned yet/)
})

test('shows a loading state instead of an empty library message', () => {
  const markup = render({ isLoading: true })

  assert.match(markup, /Loading merchant library/)
  assert.doesNotMatch(markup, /No merchants learned yet/)
})

test('offers an exclude-all control at the top and bottom of the reviewable list', () => {
  const markup = render({
    records: [
      record({ id: 'a', canonicalDisplayName: 'Greenfield Coffee' }),
      record({ id: 'b', canonicalDisplayName: 'Northwind Utilities', normalizedKey: 'northwind' })
    ]
  })

  assert.match(markup, /merchant-library-bulk-actions--top/)
  assert.match(markup, /merchant-library-bulk-actions--bottom/)
  assert.match(markup, /Exclude all shown \(2\)/g)
})

test('hides the exclude-all control once every visible record is already excluded', () => {
  const markup = render({
    records: [record({ classification: 'excluded' })]
  })

  assert.doesNotMatch(markup, /Exclude all shown/)
})

test('separates merchant candidates from private transfer flags', () => {
  const markup = render({
    records: [
      record({ id: 'a', canonicalDisplayName: 'Greenfield Coffee', userOverride: true }),
      record({
        id: 'b',
        canonicalDisplayName: 'Transfer to Sam',
        normalizedKey: 'transfer to sam',
        classificationReasons: ['transfer-prefix']
      })
    ]
  })

  assert.match(markup, /Approved/)
  assert.match(markup, /Likely personal/)
  assert.match(markup, /Transfer wording/)
  assert.match(markup, /Kept out of forecasts until you approve it/)
})

test('keeps flagged records out of the forecast toggle until approved', () => {
  const flagged = render({
    records: [record({ classificationReasons: ['email-address'] })]
  })
  const approved = render({ records: [record({ userOverride: true })] })

  assert.match(flagged, /<input type="checkbox" disabled=""\/>Forecast/)
  assert.match(approved, /<input type="checkbox"\/>Forecast/)
})

test('offers a rescan control that is disabled without a project', () => {
  const withoutProject = render()
  const withProject = render({ canRescan: true })

  assert.match(withoutProject, /Rescan project/)
  assert.match(withoutProject, /disabled=""/)
  assert.match(withProject, /Rescan project/)
})

test('surfaces errors and status separately for screen readers', () => {
  const markup = render({
    error: 'Unable to read the merchant library.',
    status: 'Merchant added.'
  })

  assert.match(markup, /role="alert">Unable to read the merchant library\./)
  assert.match(markup, /role="status" aria-live="polite">Merchant added\./)
})

test('filters by review state, project observations, and unlinked records', () => {
  const approved = record({ id: 'a', userOverride: true })
  const review = record({ id: 'b', canonicalDisplayName: 'Unknown Shop' })
  const personal = record({ id: 'c', classificationReasons: ['phone-number'] })
  const excluded = record({ id: 'd', classification: 'excluded', userOverride: true })
  const linked = record({
    id: 'e',
    userOverride: true,
    provenance: [{ projectId: 'p1', entryId: 'e1', seenAt: '2026-03-04T00:00:00.000Z' }]
  })
  const all = [approved, review, personal, excluded, linked]

  assert.deepEqual(
    filterMerchantRecords(all, 'approved', '').map((item) => item.id),
    ['a', 'e']
  )
  assert.deepEqual(
    filterMerchantRecords(all, 'review', '').map((item) => item.id),
    ['b']
  )
  assert.deepEqual(
    filterMerchantRecords(all, 'personal', '').map((item) => item.id),
    ['c']
  )
  assert.deepEqual(
    filterMerchantRecords(all, 'excluded', '').map((item) => item.id),
    ['d']
  )
  assert.deepEqual(
    filterMerchantRecords(all, 'project', '', 'p1').map((item) => item.id),
    ['e']
  )
  assert.deepEqual(
    filterMerchantRecords(all, 'unlinked', '').map((item) => item.id),
    ['a', 'b', 'c', 'd']
  )
})

test('searches display names and aliases using the shared normalizer', () => {
  const records = [
    record({ id: 'a', canonicalDisplayName: 'Greenfield Coffee' }),
    record({
      id: 'b',
      canonicalDisplayName: 'Northgate Fuel',
      normalizedKey: 'northgate fuel',
      aliases: ['NGF Petrol']
    })
  ]

  assert.deepEqual(
    filterMerchantRecords(records, 'all', 'coffee').map((item) => item.id),
    ['a']
  )
  assert.deepEqual(
    filterMerchantRecords(records, 'all', 'ngf petrol').map((item) => item.id),
    ['b']
  )
})

test('treats a user decision as final over detection flags', () => {
  assert.equal(isLikelyPersonal(record({ classificationReasons: ['transfer-prefix'] })), true)
  assert.equal(
    isLikelyPersonal(record({ classificationReasons: ['transfer-prefix'], userOverride: true })),
    false
  )
})

test('offers direction and pattern choices instead of hardcoding outgoing monthly rows', () => {
  const markup = render({ onAddScenarioRows: noop })

  assert.match(markup, /Planning forecast/)
  assert.match(markup, /Money out/)
  assert.match(markup, /Money in/)
  assert.match(markup, /Random rows/)
  assert.match(markup, /Recurring schedule/)
})

test('shows spend bounds for random rows and hides cadence until recurring is chosen', () => {
  const markup = render({ onAddScenarioRows: noop })

  assert.match(markup, /Min spend/)
  assert.match(markup, /Max spend/)
  assert.doesNotMatch(markup, /Fortnightly/)
  assert.doesNotMatch(markup, /Variability/)
})

test('hides the forecast form entirely when the caller cannot accept scenario rows', () => {
  const markup = render()

  assert.doesNotMatch(markup, /Planning forecast/)
})
