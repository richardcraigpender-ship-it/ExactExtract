import assert from 'node:assert/strict'
import test from 'node:test'

import { saveEntryImageRequest, validateEntryImageSaveRequest } from './entryImageSave'

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]).toString('base64')

test('creates a new export folder and writes validated PNG files', async () => {
  const created: string[] = []
  const written: string[] = []
  const result = await saveEntryImageRequest(
    {
      suggestedFolderName: 'Review: entry images',
      files: [
        { name: '26 March 2026 (1).png', content: png },
        { name: '26 March 2026 (2).png', content: png }
      ]
    },
    async () => ({ canceled: false, filePaths: ['C:\\Exports'] }),
    async (path) => {
      created.push(path)
    },
    async (path) => {
      written.push(path)
    }
  )

  assert.deepEqual(result, {
    status: 'saved',
    path: 'C:\\Exports\\Review- entry images',
    fileCount: 2
  })
  assert.deepEqual(created, ['C:\\Exports\\Review- entry images'])
  assert.deepEqual(written, [
    'C:\\Exports\\Review- entry images\\26 March 2026 (1).png',
    'C:\\Exports\\Review- entry images\\26 March 2026 (2).png'
  ])
})

test('rejects traversal, duplicate names, and non-PNG content', () => {
  assert.throws(
    () =>
      validateEntryImageSaveRequest({
        suggestedFolderName: 'images',
        files: [{ name: '..\\entry.png', content: png }]
      }),
    /local PNG filename/
  )
  assert.throws(
    () =>
      validateEntryImageSaveRequest({
        suggestedFolderName: 'images',
        files: [
          { name: 'entry.png', content: png },
          { name: 'ENTRY.PNG', content: png }
        ]
      }),
    /unique/
  )
  assert.throws(
    () =>
      validateEntryImageSaveRequest({
        suggestedFolderName: 'images',
        files: [{ name: 'entry.png', content: Buffer.from('not png').toString('base64') }]
      }),
    /not a PNG/
  )
})
