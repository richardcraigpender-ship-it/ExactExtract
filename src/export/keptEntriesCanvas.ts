import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { ProjectState } from '../shared/contracts'
import { applySourceMetadata, loadSourceMetadata } from './sourceMetadata'
import { buildPageNumberDraw } from './pageNumbers'
import {
  keptEntriesLayoutPageCount,
  keptEntriesPageDimensions,
  type KeptEntriesCanvasLayout,
  type KeptEntriesFontRef,
  type KeptImagePlacement
} from '../shared/keptEntriesLayout'

export interface KeptEntriesCanvasExportOptions {
  systemFontBytes?: ReadonlyMap<string, Uint8Array>
  /** PNG/JPEG data URLs keyed by image placement source ref. Bytes are never persisted. */
  imageDataUrls?: ReadonlyMap<string, string>
  /** Read only for Author/Keywords/CreationDate; page content is never taken from these. */
  sourceFiles?: ReadonlyMap<string, Uint8Array>
}

export type KeptEntriesCanvasWarningCode =
  | 'empty-layout'
  | 'missing-entry'
  | 'out-of-bounds'
  | 'overflow'
  | 'missing-background'
  | 'missing-image'
  | 'system-font-fallback'

export interface KeptEntriesCanvasWarning {
  code: KeptEntriesCanvasWarningCode
  placementId?: string
  fontFamily?: string
  imageRef?: string
}

function dimensions(layout: KeptEntriesCanvasLayout): { width: number; height: number } {
  return keptEntriesPageDimensions(layout.pageSize, layout.orientation)
}

function decodeDataUrl(dataUrl: string): { kind: 'png' | 'jpg'; bytes: Uint8Array } | undefined {
  const match = /^data:(image\/png|image\/(?:jpeg|jpg));base64,(.+)$/i.exec(dataUrl)
  if (!match) return undefined
  const binary = atob(match[2])
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return { kind: match[1].toLowerCase() === 'image/png' ? 'png' : 'jpg', bytes }
}

/** Managed backgrounds arrive as refs, so their bytes come from the same map as placed images. */
function backgroundDataUrl(
  background: KeptEntriesCanvasLayout['background'],
  options: KeptEntriesCanvasExportOptions
): string | undefined {
  if (!background) return undefined
  if (background.ref) return options.imageDataUrls?.get(background.ref)
  return background.dataUrl
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
  const images = layout.images ?? []
  const warnings: KeptEntriesCanvasWarning[] = []
  if (layout.placements.length === 0 && images.length === 0 && keptIds.size > 0) {
    warnings.push({ code: 'empty-layout' })
  }
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
  for (const placement of images) {
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
    const dataUrl = options.imageDataUrls?.get(placement.source.ref)
    if (!dataUrl || !decodeDataUrl(dataUrl)) {
      warnings.push({
        code: 'missing-image',
        placementId: placement.id,
        imageRef: placement.source.ref
      })
    }
  }
  if (layout.background) {
    const resolved = backgroundDataUrl(layout.background, options)
    if (!resolved || !decodeDataUrl(resolved)) warnings.push({ code: 'missing-background' })
  }
  return warnings
}

function fitBox(
  placement: KeptImagePlacement,
  naturalWidth: number,
  naturalHeight: number
): { x: number; y: number; width: number; height: number } {
  if (placement.fit === 'stretch' || !(naturalWidth > 0) || !(naturalHeight > 0)) {
    return { x: placement.x, y: placement.y, width: placement.width, height: placement.height }
  }
  const scale = Math.min(placement.width / naturalWidth, placement.height / naturalHeight)
  const width = naturalWidth * scale
  const height = naturalHeight * scale
  return {
    x: placement.x + (placement.width - width) / 2,
    y: placement.y + (placement.height - height) / 2,
    width,
    height
  }
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
  fontRef: KeptEntriesFontRef,
  systemFontBytes?: ReadonlyMap<string, Uint8Array>
): Promise<PDFFont> {
  if (fontRef.kind === 'system') {
    const bytes = systemFontBytes?.get(fontRef.family)
    if (bytes) return pdf.embedFont(bytes)
    return pdf.embedFont(StandardFonts.Helvetica)
  }
  return pdf.embedFont(fontRef.family)
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
  if (layout.version !== 1 && layout.version !== 2) {
    throw new Error('Unsupported kept-entries canvas layout version.')
  }
  const warnings = getKeptEntriesCanvasWarnings(project.entries, layout, options)
  const blockingWarnings = warnings.filter((warning) => warning.code === 'missing-background')
  if (blockingWarnings.length > 0) throw new Error('The canvas background image is invalid.')
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const pageSize = dimensions(layout)
  const pageCount = keptEntriesLayoutPageCount(layout)
  const pages = Array.from({ length: pageCount }, () =>
    pdf.addPage([pageSize.width, pageSize.height])
  )

  if (layout.background) {
    const resolved = backgroundDataUrl(layout.background, options)
    const image = resolved ? decodeDataUrl(resolved) : undefined
    if (image) {
      const embedded =
        image.kind === 'png' ? await pdf.embedPng(image.bytes) : await pdf.embedJpg(image.bytes)
      for (const page of pages) {
        page.drawImage(embedded, {
          x: layout.background.x,
          y: pageSize.height - layout.background.y - layout.background.height,
          width: layout.background.width,
          height: layout.background.height,
          opacity: Math.max(0, Math.min(1, layout.background.opacity))
        })
      }
    }
  }

  const embeddedImages = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>()
  const runningBalanceFont = await pdf.embedFont(StandardFonts.Helvetica)
  for (const placement of layout.images ?? []) {
    const page = pages[Math.min(pages.length, Math.max(1, placement.pageNumber)) - 1]
    let embedded = embeddedImages.get(placement.source.ref)
    if (!embedded) {
      const image = decodeDataUrl(options.imageDataUrls?.get(placement.source.ref) ?? '')
      if (!image) continue
      embedded =
        image.kind === 'png' ? await pdf.embedPng(image.bytes) : await pdf.embedJpg(image.bytes)
      embeddedImages.set(placement.source.ref, embedded)
    }
    const box = fitBox(placement, embedded.width, embedded.height)
    page.drawImage(embedded, {
      x: box.x,
      y: pageSize.height - box.y - box.height,
      width: box.width,
      height: box.height
    })

    const runningBalance = layout.imagePlacementOptions?.runningBalance
    if (placement.runningBalanceText && runningBalance?.enabled) {
      const fontSize = Math.max(6, runningBalance.fontSize)
      const balanceImage = decodeDataUrl(
        options.imageDataUrls?.get(`balance:${placement.id}`) ?? ''
      )
      if (balanceImage) {
        const embeddedBalance =
          balanceImage.kind === 'png'
            ? await pdf.embedPng(balanceImage.bytes)
            : await pdf.embedJpg(balanceImage.bytes)
        // Rendered at LABEL_SCALE in textLabelImage.ts, so its pixel size already carries the padding.
        const displayHeight = fontSize * 1.3
        const displayWidth = embeddedBalance.width * (displayHeight / embeddedBalance.height)
        page.drawImage(embeddedBalance, {
          x: box.x + box.width + runningBalance.offsetX,
          y: pageSize.height - box.y - runningBalance.offsetY - displayHeight,
          width: displayWidth,
          height: displayHeight
        })
      } else {
        // Falls back to vector text if the PNG label was not resolved for this export call.
        page.drawText(placement.runningBalanceText, {
          x: box.x + box.width + runningBalance.offsetX,
          y: pageSize.height - box.y - runningBalance.offsetY - fontSize,
          size: fontSize,
          font: runningBalanceFont,
          color: color(runningBalance.color)
        })
      }
    }

    const divider = layout.imagePlacementOptions?.divider
    if (divider?.enabled) {
      const dividerY = pageSize.height - box.y - box.height
      page.drawLine({
        start: { x: divider.startX, y: dividerY },
        end: { x: divider.endX, y: dividerY },
        thickness: divider.thickness,
        color: color(divider.color),
        opacity: Math.max(0, Math.min(1, divider.opacity))
      })
    }
  }

  for (const placement of layout.placements) {
    const page = pages[Math.min(pages.length, Math.max(1, placement.pageNumber ?? 1)) - 1]
    const font = await embedFont(pdf, placement.fontRef, options.systemFontBytes)
    page.drawText(placement.text, {
      x: placement.x,
      y: pageSize.height - placement.y - placement.height + placement.fontSize,
      size: placement.fontSize,
      font,
      color: color(placement.color),
      rotate: degrees(placement.rotation)
    })
  }

  const pageNumbers = layout.pageNumbers
  if (pageNumbers?.enabled) {
    const pageNumberFont = await embedFont(
      pdf,
      pageNumbers.textStyle.fontRef,
      options.systemFontBytes
    )
    pages.forEach((page, index) => {
      const draw = buildPageNumberDraw(
        pageNumbers,
        index + 1,
        pages.length,
        pageSize.width,
        pageSize.height,
        (text, fontSize) => pageNumberFont.widthOfTextAtSize(text, fontSize)
      )
      if (!draw) return
      page.drawText(draw.text, {
        x: draw.x,
        y: draw.y,
        size: draw.fontSize,
        font: pageNumberFont,
        color: color(pageNumbers.textStyle.color)
      })
    })
  }

  pdf.setTitle(`${project.name} - Kept Entries Layout`)
  pdf.setSubject('Custom kept-entries canvas export')
  pdf.setProducer('EXACT EXTRACT')
  pdf.setCreator('EXACT EXTRACT')
  if (options.sourceFiles) {
    applySourceMetadata(pdf, await loadSourceMetadata(project.documents, options.sourceFiles))
  }
  return pdf.save({ useObjectStreams: false })
}
