import { createHash } from 'node:crypto'
import { access, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

import { listPackage } from '@electron/asar'

const outputRoot = resolve(process.argv[2] ?? 'dist-windows-beta')
const unpackedRoot = join(outputRoot, 'win-unpacked')
const archivePath = join(unpackedRoot, 'resources', 'app.asar')
const effectiveConfigPath = join(outputRoot, 'builder-effective-config.yaml')
const executablePath = join(unpackedRoot, 'exact-extract.exe')

await Promise.all([access(archivePath), access(effectiveConfigPath), access(executablePath)])

const outputFiles = await readdir(outputRoot)
const installerName = outputFiles.find((name) =>
  /^exact-extract-\d+\.\d+\.\d+-setup\.exe$/i.test(name)
)
if (!installerName) throw new Error('Windows beta installer is missing or has an unexpected name.')
const installerPath = join(outputRoot, installerName)
const blockmapPath = `${installerPath}.blockmap`
await access(blockmapPath)

const effectiveConfig = await readFile(effectiveConfigPath, 'utf8')
const requiredConfig = [
  'appId: com.exactextract.app',
  'productName: EXACT EXTRACT',
  'executableName: exact-extract',
  'createDesktopShortcut: always'
]
for (const setting of requiredConfig) {
  if (!effectiveConfig.includes(setting)) {
    throw new Error(`Effective Windows configuration is missing: ${setting}`)
  }
}

const archiveEntries = listPackage(archivePath, { isPack: false }).map((entry) =>
  entry.replaceAll('\\', '/')
)
const archiveEntrySet = new Set(archiveEntries)
const requiredEntries = [
  '/package.json',
  '/out/main/index.js',
  '/out/preload/index.js',
  '/out/renderer/index.html',
  '/out/renderer/ocr/manifest.json',
  '/out/renderer/ocr/worker.min.js',
  '/out/renderer/ocr/core/tesseract-core-simd-lstm.wasm',
  '/out/renderer/ocr/tessdata/eng.traineddata.gz',
  '/out/renderer/ocr/tessdata/spa.traineddata.gz',
  '/out/renderer/ocr/tessdata/fra.traineddata.gz',
  '/out/renderer/ocr/tessdata/deu.traineddata.gz'
]
const missingEntries = requiredEntries.filter((entry) => !archiveEntrySet.has(entry))
if (missingEntries.length > 0) {
  throw new Error(`Required packaged files are missing: ${missingEntries.join(', ')}`)
}

const forbiddenEntry = archiveEntries.find((entry) =>
  [
    /^\/(?:src|scripts|test-data|docs)(?:\/|$)/i,
    /^\/dist[^/]*(?:\/|$)/i,
    /^\/[^/]+\.md$/i,
    /^\/(?:test-setup\.cjs|test-results\.txt)$/i,
    /\.test\.[cm]?[jt]sx?$/i,
    /\.map$/i,
    /\.(?:zip|7z|rar|asar)$/i
  ].some((pattern) => pattern.test(entry))
)
if (forbiddenEntry) throw new Error(`Development-only packaged file found: ${forbiddenEntry}`)

const unpackedArchiveRoot = join(dirname(archivePath), 'app.asar.unpacked')
const unpackedEntries = requiredEntries.filter((entry) => entry.startsWith('/out/renderer/ocr/'))
await Promise.all(
  unpackedEntries.map((entry) =>
    access(join(unpackedArchiveRoot, ...entry.replace(/^\//, '').split('/')))
  )
)

/**
 * @param {string} filePath
 * @returns {Promise<{ file: string, bytes: number, sha256: string }>}
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function artifact(filePath) {
  const bytes = await readFile(filePath)
  const details = await stat(filePath)
  return {
    file: basename(filePath),
    bytes: details.size,
    sha256: createHash('sha256').update(bytes).digest('hex')
  }
}

const artifacts = await Promise.all([
  artifact(installerPath),
  artifact(blockmapPath),
  artifact(executablePath),
  artifact(archivePath)
])
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  productName: 'EXACT EXTRACT',
  appId: 'com.exactextract.app',
  version: installerName.match(/(\d+\.\d+\.\d+)/)?.[1],
  archiveEntryCount: archiveEntries.length,
  verifiedRequiredEntries: requiredEntries.length,
  verifiedUnpackedOcrEntries: unpackedEntries.length,
  artifacts
}
await writeFile(join(outputRoot, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

console.log(
  `Verified Windows beta ${manifest.version}: ${archiveEntries.length} ASAR entries, ${requiredEntries.length} required files, ${unpackedEntries.length} unpacked OCR files.`
)
for (const item of artifacts) {
  console.log(`${item.file}: ${item.bytes} bytes, sha256 ${item.sha256}`)
}
