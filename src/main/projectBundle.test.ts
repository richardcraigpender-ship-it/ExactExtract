import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { PROJECT_SCHEMA_VERSION, type ProjectState } from '../shared/contracts'
import { createProjectBundle, importProjectBundle } from './projectBundle'

async function project(sourcePath: string): Promise<ProjectState> {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: 'bundle-project',
    name: 'Bundle project',
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
    documents: [
      {
        id: 'document-1',
        path: sourcePath,
        name: 'statement.pdf',
        size: 12,
        pageCount: 1,
        importedAt: '2026-09-12T00:00:00.000Z'
      }
    ],
    pages: [],
    entries: [],
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

test('creates and imports an opt-in source bundle with hash verification', async () => {
  const root = await mkdtemp(join(tmpdir(), 'exact-extract-bundle-'))
  const source = join(root, 'statement.pdf')
  const bundle = join(root, 'bundle')
  const imported = join(root, 'imported')
  await writeFile(source, 'PDF source bytes')

  const manifest = await createProjectBundle(await project(source), bundle, {
    includeSources: true,
    now: '2026-09-12T01:00:00.000Z'
  })
  assert.equal(manifest.includesSources, true)
  assert.equal(manifest.encrypted, false)

  const result = await importProjectBundle(bundle, imported)
  assert.equal(result.verifiedSources, 1)
  assert.equal(
    result.project.documents[0]?.path,
    join(bundle, 'sources', 'document-1-statement.pdf')
  )
  assert.equal(
    (await readFile(join(imported, 'project.json'), 'utf8')).includes('bundle-project'),
    true
  )
})

test('requires explicit source inclusion and preserves source references when excluded', async () => {
  const root = await mkdtemp(join(tmpdir(), 'exact-extract-bundle-no-source-'))
  const source = join(root, 'statement.pdf')
  await writeFile(source, 'PDF source bytes')
  const manifest = await createProjectBundle(await project(source), join(root, 'bundle'), {
    includeSources: false
  })

  assert.equal(manifest.includesSources, false)
  assert.equal(manifest.sources[0]?.included, false)
  const result = await importProjectBundle(join(root, 'bundle'), join(root, 'imported'))
  assert.equal(result.verifiedSources, 0)
  assert.equal(result.project.documents[0]?.path, source)
})

test('rejects a corrupted bundled source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'exact-extract-bundle-corrupt-'))
  const source = join(root, 'statement.pdf')
  const bundle = join(root, 'bundle')
  await writeFile(source, 'PDF source bytes')
  await createProjectBundle(await project(source), bundle, { includeSources: true })
  await writeFile(join(bundle, 'sources', 'document-1-statement.pdf'), 'tampered')

  await assert.rejects(
    importProjectBundle(bundle, join(root, 'imported')),
    /Bundle source verification failed/
  )
})
