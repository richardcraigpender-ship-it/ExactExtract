import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import { ProjectImageStore, detectProjectImageFormat, readPngDimensions } from './projectImageStore'
import { isProjectImageRef } from '../shared/projectImages'

/** Minimal valid PNG header plus IHDR for the requested size. */
function pngBytes(width: number, height: number, salt = 0): Buffer {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(17)
  ihdr.writeUInt32BE(13, 0)
  ihdr.write('IHDR', 4, 'ascii')
  ihdr.writeUInt32BE(width, 8)
  ihdr.writeUInt32BE(height, 12)
  return Buffer.concat([header, ihdr, Buffer.from([salt])])
}

async function createStore(): Promise<ProjectImageStore> {
  const root = await mkdtemp(join(tmpdir(), 'exact-extract-images-'))
  return new ProjectImageStore(join(root, 'project-images'))
}

test('reads PNG dimensions from the IHDR header', () => {
  assert.deepEqual(readPngDimensions(pngBytes(240, 60)), { width: 240, height: 60 })
})

test('detects the three background formats by signature', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(16)])
  const webp = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.alloc(4),
    Buffer.from('WEBP', 'ascii'),
    Buffer.alloc(8)
  ])

  assert.equal(detectProjectImageFormat(pngBytes(4, 4)), 'png')
  assert.equal(detectProjectImageFormat(jpeg), 'jpg')
  assert.equal(detectProjectImageFormat(webp), 'webp')
  assert.throws(() => detectProjectImageFormat(Buffer.from('not an image')), /PNG, JPEG, or WebP/)
})

test('stores a background by content and reuses the ref for identical bytes', async () => {
  const store = await createStore()
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(16, 7)])

  const first = await store.saveBackground(jpeg.toString('base64'))
  const second = await store.saveBackground(jpeg.toString('base64'))

  assert.equal(first.ref, second.ref)
  assert.match(first.ref, /\.jpg$/)
  assert.ok(isProjectImageRef(first.ref))
  assert.equal(first.ref, `${createHash('sha256').update(jpeg).digest('hex')}.jpg`)
  assert.deepEqual(await readdir(dirname(store.resolvePath(first.ref))), [first.ref])
})

test('rejects background content that is empty or not an image', async () => {
  const store = await createStore()

  await assert.rejects(() => store.saveBackground(''), /must be base64/)
  await assert.rejects(
    () => store.saveBackground(Buffer.from('nope').toString('base64')),
    /PNG, JPEG, or WebP/
  )
})

test('rejects content that is not a PNG', () => {
  assert.throws(() => readPngDimensions(Buffer.from('not-a-png')), /not a PNG/)
})

test('copies uploads into managed storage with content addressed references', async () => {
  const store = await createStore()
  const bytes = pngBytes(240, 60)

  const [descriptor] = await store.save([
    { name: 'receipt.png', content: bytes.toString('base64') }
  ])

  assert.ok(isProjectImageRef(descriptor.ref))
  assert.equal(descriptor.ref, `${createHash('sha256').update(bytes).digest('hex')}.png`)
  assert.equal(descriptor.name, 'receipt.png')
  assert.equal(descriptor.width, 240)
  assert.equal(descriptor.height, 60)
  assert.deepEqual(await store.read(descriptor.ref), bytes)
})

test('stores one copy when the same PNG is uploaded twice under different names', async () => {
  const store = await createStore()
  const content = pngBytes(100, 50).toString('base64')

  const saved = await store.save([
    { name: 'first.png', content },
    { name: 'second.png', content }
  ])

  assert.equal(saved[0].ref, saved[1].ref)
  assert.equal((await readdir(store.resolvePath(saved[0].ref).replace(/[^\\/]+$/, ''))).length, 1)
})

test('keeps every duplicate in a large batch reporting the same managed reference', async () => {
  const store = await createStore()
  const content = pngBytes(120, 60).toString('base64')
  const batch = Array.from({ length: 25 }, (_, index) => ({
    name: `receipt-${index}.png`,
    content
  }))

  const saved = await store.save(batch)

  assert.equal(saved.length, 25)
  assert.equal(new Set(saved.map((item) => item.ref)).size, 1)
  assert.deepEqual(
    saved.map((item) => item.name),
    batch.map((item) => item.name)
  )
  assert.equal((await readdir(store.resolvePath(saved[0].ref).replace(/[^\\/]+$/, ''))).length, 1)
})

test('survives concurrent saves competing for one content addressed destination', async () => {
  const store = await createStore()
  const content = pngBytes(64, 64).toString('base64')

  const batches = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      store.save([{ name: `concurrent-${index}.png`, content }])
    )
  )

  const refs = new Set(batches.map(([descriptor]) => descriptor.ref))
  assert.equal(refs.size, 1)
  const directory = store.resolvePath([...refs][0]).replace(/[^\\/]+$/, '')
  assert.deepEqual(await readdir(directory), [[...refs][0]])
})

test('keeps managed references resolvable for a later session', async () => {
  const store = await createStore()
  const [descriptor] = await store.save([
    { name: 'receipt.png', content: pngBytes(80, 40).toString('base64') }
  ])

  const reopened = new ProjectImageStore(store.resolvePath(descriptor.ref).replace(/[^\\/]+$/, ''))
  const dataUrls = await reopened.readDataUrls([descriptor.ref])

  assert.match(dataUrls[descriptor.ref], /^data:image\/png;base64,/)
})

test('refuses references that try to escape managed storage', async () => {
  const store = await createStore()

  await assert.rejects(() => store.read('../../secret.png'), /Invalid project image reference/)
  await assert.rejects(() => store.read('report.pdf'), /Invalid project image reference/)
  assert.deepEqual(await store.readDataUrls(['../../secret.png']), {})
})

test('rejects uploads that are not usable PNG content', async () => {
  const store = await createStore()

  await assert.rejects(
    () => store.save([{ name: 'fake.png', content: Buffer.from('nope').toString('base64') }]),
    /not a PNG/
  )
  await assert.rejects(() => store.save([]), /At least one PNG file is required/)
})
