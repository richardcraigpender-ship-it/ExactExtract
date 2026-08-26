import { access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import { listPackage } from '@electron/asar'

const archivePath = resolve(
  process.argv[2] ?? 'dist-offline-ocr-final/win-unpacked/resources/app.asar'
)
await access(archivePath)

const archiveEntries = new Set(
  listPackage(archivePath, { isPack: false }).map((entry) => entry.replaceAll('\\', '/'))
)
const requiredAssets = [
  '/out/renderer/ocr/manifest.json',
  '/out/renderer/ocr/worker.min.js',
  '/out/renderer/ocr/core/tesseract-core-simd-lstm.wasm',
  '/out/renderer/ocr/tessdata/eng.traineddata.gz',
  '/out/renderer/ocr/tessdata/spa.traineddata.gz',
  '/out/renderer/ocr/tessdata/fra.traineddata.gz',
  '/out/renderer/ocr/tessdata/deu.traineddata.gz'
]
const missingAssets = requiredAssets.filter((asset) => !archiveEntries.has(asset))

if (missingAssets.length > 0) {
  throw new Error(`Packaged OCR assets are missing: ${missingAssets.join(', ')}`)
}

const unpackedRoot = join(dirname(archivePath), 'app.asar.unpacked')
const unpackedAssets = requiredAssets.map((asset) =>
  join(unpackedRoot, ...asset.replace(/^\//, '').split('/'))
)
await Promise.all(unpackedAssets.map((asset) => access(asset)))

console.log(
  `Verified ${requiredAssets.length} OCR archive entries and unpacked runtime files in ${dirname(archivePath)}.`
)
