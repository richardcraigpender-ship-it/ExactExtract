import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import type { ProjectEntry } from '../shared/contracts'
import { PAYEE_LIBRARY_SCHEMA_VERSION, type PayeeObservation } from '../shared/payees'
import { normalizePayeeKey, PayeeStore } from './payeeLibraryStore'

async function withStore(
  run: (store: PayeeStore, directory: string) => Promise<void>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'exact-extract-payee-library-'))
  try {
    await run(new PayeeStore(directory), directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function entry(id: string, payee?: string): ProjectEntry {
  return {
    id,
    rawText: payee ? `${payee} 10.00` : 'Unmapped text',
    normalizedText: payee ? `${payee} 10.00` : 'Unmapped text',
    ...(payee ? { payee } : {}),
    source: payee ? 'parser' : 'ocr',
    status: 'keep',
    confidence: 0.9,
    regions: [{ documentId: 'document-1', pageNumber: 1 }],
    tags: [],
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z'
  }
}

test('normalizes exact punctuation variants and retains paired cross-project provenance', async () => {
  await withStore(async (store) => {
    await store.upsert({
      description: '  ACME\u2013Utilities  ',
      projectId: 'project-a',
      entryId: 'entry-1',
      seenAt: '2026-03-20T00:00:00.000Z'
    })
    await store.upsert({
      description: 'acme utilities',
      projectId: 'project-a',
      entryId: 'entry-1',
      seenAt: '2026-03-21T00:00:00.000Z'
    })
    await store.upsert({
      description: 'ACME-Utilities',
      projectId: 'project-b',
      entryId: 'entry-1',
      seenAt: '2026-04-20T00:00:00.000Z'
    })

    const records = await store.search('utilities')
    assert.equal(records.length, 1)
    assert.equal(records[0]?.canonicalDisplayName, 'ACME\u2013Utilities')
    assert.equal(records[0]?.normalizedKey, 'acme utilities')
    assert.equal(records[0]?.occurrenceCount, 2)
    assert.deepEqual(records[0]?.provenance, [
      {
        projectId: 'project-a',
        entryId: 'entry-1',
        seenAt: '2026-03-21T00:00:00.000Z'
      },
      {
        projectId: 'project-b',
        entryId: 'entry-1',
        seenAt: '2026-04-20T00:00:00.000Z'
      }
    ])
    assert.equal(records[0]?.firstSeenAt, '2026-03-20T00:00:00.000Z')
    assert.equal(records[0]?.lastSeenAt, '2026-04-20T00:00:00.000Z')
    assert.equal(normalizePayeeKey(' ACME.Utilities '), 'acme utilities')
  })
})

test('keeps materially different descriptions in separate records', async () => {
  await withStore(async (store) => {
    await store.upsert({
      description: 'Acme Water',
      projectId: 'project-a',
      entryId: 'water',
      seenAt: '2026-03-20T00:00:00.000Z'
    })
    await store.upsert({
      description: 'Acme Waste',
      projectId: 'project-a',
      entryId: 'waste',
      seenAt: '2026-03-20T00:00:00.000Z'
    })

    assert.deepEqual(
      (await store.list()).map((record) => record.normalizedKey),
      ['acme waste', 'acme water']
    )
  })
})

test('upserts project entries idempotently and ignores entries without a payee', async () => {
  await withStore(async (store) => {
    const entries = [entry('entry-1', 'Northwind Power'), entry('entry-2')]
    await store.upsertEntries('project-a', entries)
    await store.upsertEntries('project-a', entries)

    const records = await store.list()
    assert.equal(records.length, 1)
    assert.equal(records[0]?.occurrenceCount, 1)
    assert.equal(records[0]?.provenance[0]?.entryId, 'entry-1')
  })
})

test('quarantines malformed data and writes a fresh validated library atomically', async () => {
  await withStore(async (store, directory) => {
    await writeFile(join(directory, 'payees.json'), '{"schemaVersion":2,"records":[{}]}', 'utf8')

    assert.deepEqual(await store.list(), [])
    assert.ok((await readdir(directory)).some((name) => name.startsWith('payees.corrupt.')))

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        store.upsert({
          description: 'Concurrent Services',
          projectId: `project-${index}`,
          entryId: 'shared-entry-id',
          seenAt: `2026-04-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
        })
      )
    )

    const persisted = JSON.parse(await readFile(join(directory, 'payees.json'), 'utf8'))
    assert.equal(persisted.schemaVersion, PAYEE_LIBRARY_SCHEMA_VERSION)
    assert.equal(persisted.records[0].occurrenceCount, 8)
    assert.equal((await readdir(directory)).filter((name) => name.endsWith('.tmp')).length, 0)
  })
})

test('rejects invalid observations before writing', async () => {
  await withStore(async (store) => {
    assert.throws(() => store.upsert({} as PayeeObservation), /description/)
    assert.throws(
      () =>
        store.upsert({
          description: ' ',
          projectId: 'project-a',
          entryId: 'entry-1',
          seenAt: '2026-03-20T00:00:00.000Z'
        }),
      /description/
    )
    assert.throws(
      () =>
        store.upsert({
          description: 'Acme',
          projectId: 'project-a',
          entryId: 'entry-1',
          seenAt: 'not-a-date'
        }),
      /seenAt/
    )
  })
})
