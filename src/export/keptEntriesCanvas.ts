import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { ProjectState } from '../shared/contracts'
import type { KeptEntriesCanvasLayout, KeptEntryPlacement } from '../shared/keptEntriesLayout'

export interface KeptEntriesCanvasExportOptions {
  systemFontBytes?: ReadonlyMap<string, Uint8Array>
}

export type KeptEntriesCanvasWarningCode =
  | 'empty-layout'
  | 'missing-entry'
  | 'out-of-bounds'
  | 'overflow'
  | 'missing-background'
  | 'system-font-fallback'

export interface KeptEntriesCanvasWarning {
  code: KeptEntriesCanvasWarningCode
  placementId?: string
  fontFamily?: string
}

const PAGE_DIMENSIONS = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 }
} as const

function dimensions(layout: KeptEntriesCanvasLayout): { width: number; height: number } {
  const page = PAGE_DIMENSIONS[layout.pageSize]
  return layout.orientation === 'portrait' ? page : { width: page.height, height: page.width }
}

function decodeDataUrl(dataUrl: string): { kind: 'png' | 'jpg'; bytes: Uint8Array } | undefined {
  const match = /^data:(image\/png|image\/(?:jpeg|jpg));base64,(.+)$/i.exec(dataUrl)
  if (!match) return undefined
  const bytes = Uint8Array.from(Buffer.from(match[2], 'base64'))
  return { kind: match[1].toLowerCase() === 'image/png' ? 'png' : 'jpg', bytes }
}

export function getKeptEntriesCanvasWarnings(
  entries: readonly ProjectState['entries'][number][],
  layout: KeptEntriesCanvasLayout,
  options: KeptEntriesCanvasExportOptions = {}
): KeptEntriesCanvasWarning[] {
  const pageSize = dimensions(layout)
  const keptIds = new Set(
    entries.filter((entry) => entry.status === 'keep').map((entry) => entry.id)
  )
  const warnings: KeptEntriesCanvasWarning[] = []
  if (layout.placements.length === 0 && keptIds.size > 0) warnings.push({ code: 'empty-layout' })
  for (const placement of layout.placements) {
    if (placement.entryId && !keptIds.has(placement.entryId)) {
      warnings.push({ code: 'missing-entry', placementId: placement.id })
    }
    if (
      placement.x < 0 ||
      placement.y < 0 ||
      placement.x + placement.width > pageSize.width ||
      placement.y + placement.height > pageSize.height
    ) {
      warnings.push({ code: 'out-of-bounds', placementId: placement.id })
    }
    if (
      placement.text.length >
      Math.max(40, Math.floor((placement.width / Math.max(1, placement.fontSize)) * 1.8))
    ) {
      warnings.push({ code: 'overflow', placementId: placement.id })
    }
    if (
      placement.fontRef.kind === 'system' &&
      !options.systemFontBytes?.has(placement.fontRef.family)
    ) {
      warnings.push({ code: 'system-font-fallback', fontFamily: placement.fontRef.family })
    }
  }
  if (layout.background && !decodeDataUrl(layout.background.dataUrl)) {
    warnings.push({ code: 'missing-background' })
  }
  return warnings
}

function color(value: string): ReturnType<typeof rgb> {
  const match = /^#([\da-f]{6})$/i.exec(value.trim())
  if (!match) return rgb(0.09, 0.14, 0.11)
  return rgb(
    Number.parseInt(match[1].slice(0, 2), 16) / 255,
    Number.parseInt(match[1].slice(2, 4), 16) / 255,
    Number.parseInt(match[1].slice(4, 6), 16) / 255
  )
}

async function embedFont(
  pdf: PDFDocument,
  placement: KeptEntryPlacement,
  systemFontBytes?: ReadonlyMap<string, Uint8Array>
): Promise<PDFFont> {
  if (placement.fontRef.kind === 'system') {
    const bytes = systemFontBytes?.get(placement.fontRef.family)
    if (bytes) return pdf.embedFont(bytes)
    return pdf.embedFont(StandardFonts.Helvetica)
  }
  return pdf.embedFont(placement.fontRef.family)
}

function defaultLayout(project: ProjectState): KeptEntriesCanvasLayout {
  return {
    version: 1,
    pageSize: 'letter',
    orientation: 'portrait',
    placements: project.entries
      .filter((entry) => entry.status === 'keep')
      .map((entry, index) => ({
        id: `kept-entry-${entry.id}`,
        entryId: entry.id,
        text: entry.normalizedText,
        x: 48,
        y: 48 + index * 30,
        width: 516,
        height: 22,
        rotation: 0,
        fontRef: { kind: 'standard-14' as const, family: 'Helvetica' as const },
        fontSize: 11,
        color: '#17231c'
      }))
  }
}

export async function exportProjectKeptEntriesCanvasPdf(
  project: ProjectState,
  layout: KeptEntriesCanvasLayout = project.keptEntriesLayout ?? defaultLayout(project),
  options: KeptEntriesCanvasExportOptions = {}
): Promise<Uint8Array> {
  if (layout.version !== 1) throw new Error('Unsupported kept-entries canvas layout version.')
  const warnings = getKeptEntriesCanvasWarnings(project.entries, layout, options)
  const blockingWarnings = warnings.filter((warning) => warning.code === 'missing-background')
  if (blockingWarnings.length > 0) throw new Error('The canvas background image is invalid.')
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const pageSize = dimensions(layout)
  const page = pdf.addPage([pageSize.width, pageSize.height])

  if (layout.background) {
    const image = decodeDataUrl(layout.background.dataUrl)
    if (image) {
      const embedded =
        image.kind === 'png' ? await pdf.embedPng(image.bytes) : await pdf.embedJpg(image.bytes)
      page.drawImage(embedded, {
        x: layout.background.x,
        y: pageSize.height - layout.background.y - layout.background.height,
        width: layout.background.width,
        height: layout.background.height,
        opacity: Math.max(0, Math.min(1, layout.background.opacity))
      })
    }
  }

  for (const placement of layout.placements) {
    const font = await embedFont(pdf, placement, options.systemFontBytes)
    page.drawText(placement.text, {
      x: placement.x,
      y: pageSize.height - placement.y - placement.height + placement.fontSize,
      size: placement.fontSize,
      font,
      color: color(placement.color),
      rotate: degrees(placement.rotation)
    })
  }

  pdf.setTitle(`${project.name} - Kept Entries Layout`)
  pdf.setSubject('Custom kept-entries canvas export')
  pdf.setProducer('EXACT EXTRACT')
  pdf.setCreator('EXACT EXTRACT')
  return pdf.save({ useObjectStreams: false })
}
