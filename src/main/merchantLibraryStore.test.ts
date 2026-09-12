import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import { classifyMerchantCandidate } from '../shared/merchants'
import { MerchantStore } from './merchantLibraryStore'

async function withStore(run: (store: MerchantStore) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'exact-extract-merchant-library-'))
  try {
    await run(new MerchantStore(directory))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function entry(id: string, payee: string, date?: string): ProjectEntry {
  return {
    id,
    rawText: payee,
    normalizedText: payee,
    payee,
    source: 'parser',
    status: 'keep',
    confidence: 1,
    regions: [{ documentId: 'document-1', pageNumber: 2, id: 'region-1' }],
    tags: [],
    ...(date ? { date } : {}),
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z'
  }
}

test('flags transfer phrases and private identifiers as likely personal', () => {
  assert.deepEqual(classifyMerchantCandidate('Transferred to Jamie Smith').reasons, [
    'transfer-prefix'
  ])
  assert.equal(
    classifyMerchantCandidate('sent by a@example.test').classification,
    'likely-personal'
  )
  assert.equal(classifyMerchantCandidate('Tesco Stores').classification, 'merchant-candidate')
})

test('keeps likely-personal transfers out of automatic merchant storage', async () => {
  await withStore(async (store) => {
    const summary = await store.upsertEntries('project-1', [
      entry('merchant-entry', 'Northwind Utilities'),
      entry('private-entry', 'Paid to Jamie Smith')
    ])
    await store.upsertEntries('project-1', [entry('merchant-entry', 'Northwind Utilities')])

    const records = await store.list()
    assert.deepEqual(summary, { added: 1, flaggedPersonal: 1 })
    assert.equal(records.length, 1)
    assert.equal(records[0]?.canonicalDisplayName, 'Northwind Utilities')
    assert.equal(records[0]?.occurrenceCount, 1)
    assert.equal(records[0]?.provenance[0]?.documentId, 'document-1')
    assert.equal(records[0]?.provenance[0]?.pageNumber, 2)
  })
})

test('tracks first/last seen from the transaction date, not the import timestamp', async () => {
  await withStore(async (store) => {
    await store.upsertEntries('project-1', [
      entry('entry-1', 'Northwind Utilities', '2026-01-05'),
      entry('entry-2', 'Northwind Utilities', '2026-03-20')
    ])

    const records = await store.list()
    assert.equal(records[0]?.firstSeenAt, '2026-01-05')
    assert.equal(records[0]?.lastSeenAt, '2026-03-20')
  })
})

test('supports manual creation, exclusion, and permanent deletion', async () => {
  await withStore(async (store) => {
    const created = await store.create({
      displayName: 'Corner Market',
      defaultAmount: 25,
      direction: 'out'
    })
    const excluded = await store.update(created.id, {
      classification: 'excluded',
      forecastIncluded: false,
      direction: 'in'
    })
    assert.equal(excluded.userOverride, true)
    assert.equal(excluded.classification, 'excluded')
    assert.equal(excluded.forecastIncluded, false)
    assert.equal(excluded.direction, 'in')

    await store.remove(created.id)
    assert.deepEqual(await store.list(), [])
  })
})
