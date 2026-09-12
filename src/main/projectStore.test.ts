import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { PayeeStore } from './payeeLibraryStore'
import { ProjectStore } from './projectStore'

async function withStore(
  run: (store: ProjectStore, directory: string) => Promise<void>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'pdf-studio-project-store-'))
  try {
    await run(new ProjectStore(directory), directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('creates, saves, and reopens a project', async () => {
  await withStore(async (store) => {
    const project = store.create('Quarterly Review', 'quarterly-review')
    project.entries.push({
      id: 'entry-1',
      rawText: 'Total 1,250',
      normalizedText: 'Total 1,250',
      payee: 'Northwind Services',
      source: 'parser',
      status: 'keep',
      confidence: 0.98,
      regions: [{ documentId: 'document-1', pageNumber: 1 }],
      tags: [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    })

    await store.save(project)
    const reopened = await store.load(project.id)

    assert.equal(reopened.name, 'Quarterly Review')
    assert.equal(reopened.entries[0]?.status, 'keep')
    assert.equal(reopened.entries[0]?.payee, 'Northwind Services')
    assert.equal(reopened.schemaVersion, 1)
  })
})

test('round-trips persisted analysis and kept-entry layout state', async () => {
  await withStore(async (store, directory) => {
    const project = store.create('Configured Review', 'configured-review')
    project.auditTrail.push({
      id: 'configured-review:analysis-state',
      occurredAt: project.createdAt,
      action: 'analysis-state-saved',
      entityType: 'analysis',
      entityId: project.id,
      details: { state: '{"financialMapping":{"amountColumns":["money-out","balance"]}}' }
    })
    project.keptEntriesLayout = {
      version: 1,
      pageSize: 'a4',
      orientation: 'landscape',
      placements: [
        {
          id: 'placement-1',
          entryId: 'entry-1',
          text: 'Northwind Services',
          x: 24,
          y: 36,
          width: 180,
          height: 24,
          rotation: 0,
          fontRef: { kind: 'standard-14', family: 'Helvetica' },
          fontSize: 11,
          color: '#102030'
        }
      ]
    }

    await store.save(project)
    const reopened = await new ProjectStore(directory).load(project.id)

    assert.deepEqual(reopened.auditTrail, project.auditTrail)
    assert.deepEqual(reopened.keptEntriesLayout, project.keptEntriesLayout)
  })
})

test('round-trips project-scoped review presets and rejects invalid filters', async () => {
  await withStore(async (store, directory) => {
    const project = store.create('Preset review', 'preset-review')
    project.reviewPresets = [
      {
        id: 'built-in:needs-attention',
        name: 'Needs attention',
        scope: 'project',
        filters: { queueReasonCode: 'any' },
        createdAt: project.createdAt,
        updatedAt: project.createdAt
      }
    ]

    await store.save(project)
    const reopened = await new ProjectStore(directory).load(project.id)
    assert.deepEqual(reopened.reviewPresets, project.reviewPresets)

    const invalid = { ...reopened, reviewPresets: [{ ...project.reviewPresets[0], filters: { queueReasonCode: 'not-real' } }] }
    assert.throws(() => store.save(invalid as typeof project), /queueReasonCode/)
  })
})

test('round-trips a multi-page kept-image layout without embedding image bytes', async () => {
  await withStore(async (store, directory) => {
    const project = store.create('Image layout', 'image-layout')
    project.keptEntriesLayout = {
      version: 2,
      pageSize: 'letter',
      orientation: 'portrait',
      placements: [],
      pageCount: 2,
      images: [
        {
          id: 'image-1',
          source: { kind: 'session-entry', ref: 'entry-1' },
          entryId: 'entry-1',
          pageNumber: 1,
          x: 48,
          y: 48,
          width: 240,
          height: 36,
          fit: 'contain'
        },
        {
          id: 'image-2',
          source: { kind: 'uploaded-png', ref: 'managed/image-2.png' },
          pageNumber: 2,
          x: 48,
          y: 48,
          width: 240,
          height: 36,
          fit: 'stretch'
        }
      ]
    }

    await store.save(project)
    const reopened = await new ProjectStore(directory).load(project.id)

    assert.deepEqual(reopened.keptEntriesLayout, project.keptEntriesLayout)
    assert.doesNotMatch(JSON.stringify(reopened.keptEntriesLayout), /data:image|base64/i)
  })
})

test('persists removed source pages across project reopen', async () => {
  await withStore(async (store, directory) => {
    const project = store.create('Removed pages', 'removed-pages')
    project.documents.push({
      id: 'document-1',
      path: 'statement.pdf',
      name: 'statement.pdf',
      size: 100,
      pageCount: 3,
      removedPages: [2],
      importedAt: project.createdAt
    })

    await store.save(project)
    const reopened = await new ProjectStore(directory).load(project.id)

    assert.deepEqual(reopened.documents[0]?.removedPages, [2])
    assert.equal(reopened.documents[0]?.pageCount, 3)
  })
})

test('persists compact document style profiles across project reopen', async () => {
  await withStore(async (store, directory) => {
    const project = store.create('Styled document', 'styled-document')
    project.documents.push({
      id: 'document-1',
      path: 'statement.pdf',
      name: 'statement.pdf',
      size: 100,
      importedAt: project.createdAt,
      styleProfile: {
        id: 'style-profile-1',
        documentId: 'document-1',
        generatedAt: project.createdAt,
        detectorVersion: 1,
        source: 'pdf-text',
        confidence: 'high',
        textStyles: [
          {
            id: 'body-style',
            fontFamily: 'Helvetica',
            fontSize: 11,
            fontWeight: 'regular',
            italic: false,
            underline: false,
            colour: { hex: '#17231c', name: 'Text' },
            likelyRole: 'body',
            occurrenceCount: 8,
            characterCount: 120,
            pageNumbers: [1],
            sampleText: ['Transaction row']
          }
        ],
        dividerStyles: [],
        colourPalette: [{ hex: '#17231c', name: 'Text', occurrenceCount: 8, likelyRole: 'text' }],
        pageSummaries: [
          {
            pageNumber: 1,
            textStyleClusterIds: ['body-style'],
            dominantTextStyleId: 'body-style',
            imageObjectCount: 0,
            characterCount: 120
          }
        ],
        warnings: []
      }
    })

    await store.save(project)
    const reopened = await new ProjectStore(directory).load(project.id)

    assert.deepEqual(reopened.documents[0]?.styleProfile, project.documents[0]?.styleProfile)
  })
})

test('removing a recent project preserves its file and global payees', async () => {
  await withStore(async (store, directory) => {
    const payeeStore = new PayeeStore(directory)
    const project = store.create('Payee History', 'payee-history')
    project.entries.push({
      id: 'entry-1',
      rawText: 'Northwind Services 42.00',
      normalizedText: 'Northwind Services 42.00',
      payee: 'Northwind Services',
      source: 'parser',
      status: 'keep',
      confidence: 0.98,
      regions: [{ documentId: 'document-1', pageNumber: 1 }],
      tags: [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    })

    await store.save(project)
    await payeeStore.upsertEntries(project.id, project.entries)
    await store.removeRecent(project.id)

    assert.deepEqual(await store.listRecent(), [])
    assert.equal((await store.load(project.id)).name, project.name)
    const payees = await payeeStore.list()
    assert.equal(payees[0]?.canonicalDisplayName, 'Northwind Services')
    assert.equal(payees[0]?.provenance[0]?.projectId, project.id)
  })
})

test('accepts a retry after a real filesystem save failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pdf-studio-project-retry-'))
  const blockedRoot = join(directory, 'blocked-root')
  await writeFile(blockedRoot, 'not a directory', 'utf8')
  const store = new ProjectStore(blockedRoot)
  const project = store.create('Retry Save', 'retry-save')

  try {
    await assert.rejects(store.save(project))

    await rm(blockedRoot, { force: true })
    await mkdir(blockedRoot)
    await store.save(project)

    const reopened = await store.load(project.id)
    assert.equal(reopened.id, project.id)
    assert.deepEqual(
      (await store.listRecent()).map((recent) => recent.id),
      [project.id]
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('serializes saves and keeps recent projects ordered', async () => {
  await withStore(async (store) => {
    const first = store.create('First', 'first')
    const second = store.create('Second', 'second')

    await Promise.all([store.save(first), store.save(second)])
    const recent = await store.listRecent()

    assert.deepEqual(
      recent.map((project) => project.id),
      ['second', 'first']
    )

    await store.removeRecent('second')
    assert.deepEqual(
      (await store.listRecent()).map((project) => project.id),
      ['first']
    )
  })
})

test('loads consistently while a save is queued', async () => {
  await withStore(async (store) => {
    const project = store.create('Queued save', 'queued-save')

    const saving = store.save(project)
    const reopened = await store.load(project.id)
    await saving

    assert.equal(reopened.id, project.id)
    assert.equal(reopened.name, project.name)
  })
})

test('rejects malformed projects and unsafe project IDs', async () => {
  await withStore(async (store, directory) => {
    assert.throws(() => store.create('Unsafe', '../outside'), /Invalid project ID/)

    const projectsDirectory = join(directory, 'projects')
    const valid = store.create('Valid', 'invalid-on-disk')
    await store.save(valid)
    await writeFile(join(projectsDirectory, 'invalid-on-disk.json'), '{"schemaVersion":99}', 'utf8')

    await assert.rejects(store.load('invalid-on-disk'), /Unsupported project schema version/)
    const index = JSON.parse(await readFile(join(directory, 'recent-projects.json'), 'utf8'))
    assert.equal(index[0].id, 'invalid-on-disk')
  })
})

test('rejects corrupt nested project data', async () => {
  await withStore(async (store, directory) => {
    const project = store.create('Nested validation', 'nested-validation')
    await store.save(project)

    const projectPath = join(directory, 'projects', 'nested-validation.json')
    const corrupt = JSON.parse(await readFile(projectPath, 'utf8'))
    corrupt.entries = [{ id: 'incomplete-entry' }]
    await writeFile(projectPath, JSON.stringify(corrupt), 'utf8')

    await assert.rejects(store.load('nested-validation'), /entries\[0\]\.rawText/)
  })
})
