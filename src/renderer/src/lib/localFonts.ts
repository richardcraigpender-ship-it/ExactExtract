import { StandardFonts } from 'pdf-lib'

export interface SystemFontOption {
  family: string
  fullName: string
  postscriptName: string
  style: string
}

export type PdfFontRef =
  | { kind: 'standard'; name: StandardFonts }
  | { kind: 'system'; family: string; style: string; postscriptName: string }

export interface FontResolution {
  ref: PdfFontRef
  bytes: Uint8Array | null
  fellBackToHelvetica: boolean
}

interface LocalFontData {
  readonly family: string
  readonly fullName: string
  readonly postscriptName: string
  readonly style: string
  blob(): Promise<Blob>
}

interface WindowWithLocalFonts {
  queryLocalFonts?: (options?: { postscriptNames?: string[] }) => Promise<LocalFontData[]>
}

function getLocalFontsScope(): WindowWithLocalFonts | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as WindowWithLocalFonts)
}

export function isLocalFontAccessSupported(): boolean {
  return typeof getLocalFontsScope()?.queryLocalFonts === 'function'
}

// Local Font Access requires a user gesture (e.g. a click) to grant the local-fonts permission.
export async function listSystemFonts(): Promise<SystemFontOption[]> {
  const scope = getLocalFontsScope()
  if (!scope?.queryLocalFonts) return []
  const fonts = await scope.queryLocalFonts()
  const byPostscriptName = new Map<string, SystemFontOption>()
  for (const font of fonts) {
    if (!byPostscriptName.has(font.postscriptName)) {
      byPostscriptName.set(font.postscriptName, {
        family: font.family,
        fullName: font.fullName,
        postscriptName: font.postscriptName,
        style: font.style
      })
    }
  }
  return [...byPostscriptName.values()].sort(
    (left, right) =>
      left.family.localeCompare(right.family) || left.style.localeCompare(right.style)
  )
}

export async function fetchSystemFontBytes(postscriptName: string): Promise<Uint8Array | null> {
  const scope = getLocalFontsScope()
  if (!scope?.queryLocalFonts) return null
  const [match] = await scope.queryLocalFonts({ postscriptNames: [postscriptName] })
  if (!match) return null
  const blob = await match.blob()
  return new Uint8Array(await blob.arrayBuffer())
}

// Falls back to Helvetica when a previously chosen system font is no longer installed,
// matching the app's existing missing-source-file recovery pattern rather than failing export.
export async function resolveFontForExport(fontRef: PdfFontRef): Promise<FontResolution> {
  if (fontRef.kind === 'standard') {
    return { ref: fontRef, bytes: null, fellBackToHelvetica: false }
  }
  const bytes = await fetchSystemFontBytes(fontRef.postscriptName)
  if (bytes) return { ref: fontRef, bytes, fellBackToHelvetica: false }
  return {
    ref: { kind: 'standard', name: StandardFonts.Helvetica },
    bytes: null,
    fellBackToHelvetica: true
  }
}
