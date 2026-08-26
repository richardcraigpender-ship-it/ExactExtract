import assert from 'node:assert/strict'
import test from 'node:test'
import { StandardFonts } from 'pdf-lib'

import {
  fetchSystemFontBytes,
  isLocalFontAccessSupported,
  listSystemFonts,
  resolveFontForExport
} from './localFonts'

interface StubLocalFontData {
  family: string
  fullName: string
  postscriptName: string
  style: string
  bytes: Uint8Array
}

function stubFont(overrides: Partial<StubLocalFontData> = {}): StubLocalFontData {
  return {
    family: 'Example Sans',
    fullName: 'Example Sans Regular',
    postscriptName: 'ExampleSans-Regular',
    style: 'Regular',
    bytes: new Uint8Array([1, 2, 3, 4]),
    ...overrides
  }
}

function installQueryLocalFonts(
  fonts: StubLocalFontData[],
  implementation?: (options?: { postscriptNames?: string[] }) => Promise<StubLocalFontData[]>
): () => void {
  const queryLocalFonts =
    implementation ??
    (async (options?: { postscriptNames?: string[] }) =>
      options?.postscriptNames
        ? fonts.filter((font) => options.postscriptNames!.includes(font.postscriptName))
        : fonts)

  ;(globalThis as { window?: unknown }).window = {
    queryLocalFonts: async (options?: { postscriptNames?: string[] }) => {
      const matches = await queryLocalFonts(options)
      return matches.map((font) => ({
        family: font.family,
        fullName: font.fullName,
        postscriptName: font.postscriptName,
        style: font.style,
        blob: async () => ({
          arrayBuffer: async () => font.bytes.buffer.slice(0)
        })
      }))
    }
  }
  return () => {
    delete (globalThis as { window?: unknown }).window
  }
}

test('reports Local Font Access as unsupported when window.queryLocalFonts is absent', () => {
  delete (globalThis as { window?: unknown }).window
  assert.equal(isLocalFontAccessSupported(), false)
})

test('reports Local Font Access as supported once queryLocalFonts is present', () => {
  const cleanup = installQueryLocalFonts([stubFont()])
  try {
    assert.equal(isLocalFontAccessSupported(), true)
  } finally {
    cleanup()
  }
})

test('lists installed system fonts sorted by family then style, deduplicated by postscript name', async () => {
  const cleanup = installQueryLocalFonts([
    stubFont({ family: 'Zeta', style: 'Bold', postscriptName: 'Zeta-Bold' }),
    stubFont({ family: 'Alpha', style: 'Regular', postscriptName: 'Alpha-Regular' }),
    stubFont({ family: 'Alpha', style: 'Regular', postscriptName: 'Alpha-Regular' }),
    stubFont({ family: 'Alpha', style: 'Bold', postscriptName: 'Alpha-Bold' })
  ])
  try {
    const fonts = await listSystemFonts()
    assert.deepEqual(
      fonts.map((font) => `${font.family}:${font.style}`),
      ['Alpha:Bold', 'Alpha:Regular', 'Zeta:Bold']
    )
  } finally {
    cleanup()
  }
})

test('returns an empty list when Local Font Access is unsupported', async () => {
  delete (globalThis as { window?: unknown }).window
  assert.deepEqual(await listSystemFonts(), [])
})

test('fetches font bytes for a chosen postscript name', async () => {
  const cleanup = installQueryLocalFonts([stubFont({ bytes: new Uint8Array([9, 8, 7]) })])
  try {
    const bytes = await fetchSystemFontBytes('ExampleSans-Regular')
    assert.deepEqual(bytes ? [...bytes] : null, [9, 8, 7])
  } finally {
    cleanup()
  }
})

test('returns null when the requested font is no longer installed', async () => {
  const cleanup = installQueryLocalFonts([stubFont()], async () => [])
  try {
    assert.equal(await fetchSystemFontBytes('Missing-Font'), null)
  } finally {
    cleanup()
  }
})

test('resolveFontForExport passes through standard fonts without touching Local Font Access', async () => {
  delete (globalThis as { window?: unknown }).window
  const resolution = await resolveFontForExport({
    kind: 'standard',
    name: StandardFonts.TimesRoman
  })
  assert.deepEqual(resolution, {
    ref: { kind: 'standard', name: StandardFonts.TimesRoman },
    bytes: null,
    fellBackToHelvetica: false
  })
})

test('resolveFontForExport embeds a still-installed system font', async () => {
  const cleanup = installQueryLocalFonts([stubFont({ bytes: new Uint8Array([5, 6]) })])
  try {
    const resolution = await resolveFontForExport({
      kind: 'system',
      family: 'Example Sans',
      style: 'Regular',
      postscriptName: 'ExampleSans-Regular'
    })
    assert.equal(resolution.fellBackToHelvetica, false)
    assert.deepEqual(resolution.bytes ? [...resolution.bytes] : null, [5, 6])
  } finally {
    cleanup()
  }
})

test('resolveFontForExport falls back to Helvetica when the system font is missing', async () => {
  const cleanup = installQueryLocalFonts([], async () => [])
  try {
    const resolution = await resolveFontForExport({
      kind: 'system',
      family: 'Ghost Font',
      style: 'Regular',
      postscriptName: 'GhostFont-Regular'
    })
    assert.deepEqual(resolution, {
      ref: { kind: 'standard', name: StandardFonts.Helvetica },
      bytes: null,
      fellBackToHelvetica: true
    })
  } finally {
    cleanup()
  }
})
