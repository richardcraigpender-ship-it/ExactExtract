import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { collectProjectImageRefs, pruneProjectImages } from './projectImageRetention'

const usedRef = `${'a'.repeat(64)}.png`
const orphanRef = `${'b'.repeat(64)}.png`

function projectJson(refs: string[]): string {
  return JSON.stringify({
    keptEntriesLayout: {
      version: 2,
      images: refs.map((ref, index) => ({
        id: `kept-image-${index + 1}`,
        source: { kind: 'uploaded-png', ref }
      }))
    }
  })
}

async function createWorkspace(): Promise<{ images: string; projects: string }> {
  const root = await mkdtemp(join(tmpdir(), 'exact-extract-retention-'))
  const images = join(root, 'project-images')
  const projects = join(root, 'projects')
  await mkdir(images, { recursive: true })
  await mkdir(projects, { recursive: true })
  await writeFile(join(images, usedRef), 'used')
  await writeFile(join(images, orphanRef), 'orphan')
  await writeFile(join(images, `${usedRef}.abc.tmp`), 'interrupted')
  return { images, projects }
}

test('collects only managed upload refs from a project layout', () => {
  assert.deepEqual(collectProjectImageRefs(JSON.parse(projectJson([usedRef, '../secret.png']))), [
    usedRef
  ])
  assert.deepEqual(collectProjectImageRefs({ keptEntriesLayout: { version: 1 } }), [])
  assert.deepEqual(collectProjectImageRefs(null), [])
})

test('collects canvas and template background refs so they are never pruned', () => {
  const canvasBackground = `${'c'.repeat(64)}.jpg`
  const pageOneBackground = `${'d'.repeat(64)}.webp`
  const laterPagesBackground = `${'e'.repeat(64)}.png`

  const refs = collectProjectImageRefs({
    keptEntriesLayout: { version: 2, background: { ref: canvasBackground } },
    keptExportTemplate: {
      pageOneTemplate: { background: { ref: pageOneBackground } },
      laterPagesTemplate: { background: { ref: laterPagesBackground } }
    }
  })

  assert.deepEqual(refs.sort(), [canvasBackground, pageOneBackground, laterPagesBackground].sort())
})

test('ignores legacy inline backgrounds and unsafe background refs', () => {
  assert.deepEqual(
    collectProjectImageRefs({
      keptEntriesLayout: { version: 2, background: { dataUrl: 'data:image/png;base64,AAAA' } },
      keptExportTemplate: {
        pageOneTemplate: { background: { ref: '../secret.png' } },
        laterPagesTemplate: {}
      }
    }),
    []
  )
})

test('removes unreferenced images and interrupted writes, keeping referenced ones', async () => {
  const { images, projects } = await createWorkspace()
  await writeFile(join(projects, 'project-1.json'), projectJson([usedRef]))

  const result = await pruneProjectImages(images, projects)

  assert.equal(result.kept, 1)
  assert.deepEqual(result.removed.sort(), [orphanRef, `${usedRef}.abc.tmp`].sort())
  assert.deepEqual(await readdir(images), [usedRef])
})

test('keeps images referenced by any stored project, not only the newest', async () => {
  const { images, projects } = await createWorkspace()
  await writeFile(join(projects, 'project-1.json'), projectJson([usedRef]))
  await writeFile(join(projects, 'project-2.json'), projectJson([orphanRef]))

  const result = await pruneProjectImages(images, projects)

  assert.deepEqual(result.removed, [`${usedRef}.abc.tmp`])
  assert.equal((await readdir(images)).length, 2)
})

test('deletes nothing when the reference set cannot be established', async () => {
  const { images, projects } = await createWorkspace()
  await writeFile(join(projects, 'project-1.json'), '{ not json')

  await assert.rejects(pruneProjectImages(images, projects), /image retention/)
  assert.equal((await readdir(images)).length, 3)
})

test('is a no-op when no managed image directory exists yet', async () => {
  const { projects } = await createWorkspace()

  assert.deepEqual(await pruneProjectImages(join(projects, 'missing'), projects), {
    kept: 0,
    removed: []
  })
})
