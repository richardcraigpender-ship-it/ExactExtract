import type { KeptExportPageNumbers } from './keptExportTemplate'

export type KeptEntriesPageSize = 'letter' | 'a4'
export type KeptEntriesOrientation = 'portrait' | 'landscape'
export type KeptEntriesFontRef =
  | { kind: 'standard-14'; family: 'Helvetica' | 'Helvetica-Bold' | 'Times-Roman' | 'Courier' }
  | { kind: 'system'; family: string; style?: string }

/** 1 = single page, text placements only. 2 = multi-page, text and image placements. */
export type KeptEntriesLayoutVersion = 1 | 2

export const KEPT_ENTRIES_LAYOUT_VERSION: KeptEntriesLayoutVersion = 2

export interface KeptEntryPlacement {
  id: string
  entryId?: string
  text: string
  /** 1-based; absent means page 1 so version-1 layouts stay valid. */
  pageNumber?: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fontRef: KeptEntriesFontRef
  fontSize: number
  color: string
}

export type KeptImageSourceKind = 'session-entry' | 'uploaded-png'

export interface KeptImageSourceDescriptor {
  kind: KeptImageSourceKind
  ref: string
  entryId?: string
  name?: string
  naturalWidth: number
  naturalHeight: number
}

export interface KeptEntriesDivider {
  enabled: boolean
  width: number
  thickness: number
  color: string
  opacity: number
  startX: number
  endX: number
}

export interface KeptImageRunningBalanceOptions {
  enabled: boolean
  /** Gap between an image's right edge and the running balance text. */
  offsetX: number
  /** Distance above the slot top where the balance baseline row starts. */
  offsetY: number
  fontSize: number
  color: string
}

export interface KeptImagePlacementOptions {
  sourceMode: KeptImageSourceKind
  startX: number
  startY: number
  endY?: number
  fillBetweenY: boolean
  entriesPerPage: number
  gap: number
  width?: number
  height?: number
  preserveAspectRatio: boolean
  uniformSlots: boolean
  /** Drawn after every placed image when enabled. */
  divider?: KeptEntriesDivider
  /** Optional running-balance text placed beside session-entry images. */
  runningBalance?: KeptImageRunningBalanceOptions
}

/**
 * Image bytes are never persisted in the layout. `ref` identifies a kept entry (session) or a
 * project-managed PNG (upload) that the caller resolves at render time.
 */
export interface KeptImageSourceRef {
  kind: KeptImageSourceKind
  ref: string
}

export type KeptImageFit = 'contain' | 'stretch'

export interface KeptImagePlacement {
  id: string
  source: KeptImageSourceRef
  entryId?: string
  /** 1-based. */
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  fit: KeptImageFit
  /** Precomputed running balance rendered next to this image when enabled. */
  runningBalanceText?: string
}

export interface KeptEntriesBackground {
  /** Content-addressed ref into managed image storage; the persisted form. */
  ref?: string
  /** Legacy inline bytes from before managed background storage, migrated to `ref` on load. */
  dataUrl?: string
  x: number
  y: number
  width: number
  height: number
  opacity: number
}

export interface KeptEntriesCanvasLayout {
  version: KeptEntriesLayoutVersion
  pageSize: KeptEntriesPageSize
  orientation: KeptEntriesOrientation
  placements: KeptEntryPlacement[]
  images?: KeptImagePlacement[]
  imagePlacementOptions?: KeptImagePlacementOptions
  uploadedImageSources?: KeptImageSourceDescriptor[]
  /** Planned page total; page numbers carried by placements can still exceed it. */
  pageCount?: number
  background?: KeptEntriesBackground
  pageNumbers?: KeptExportPageNumbers
}

const PAGE_DIMENSIONS = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 }
} as const

export function keptEntriesPageDimensions(
  pageSize: KeptEntriesPageSize,
  orientation: KeptEntriesOrientation
): { width: number; height: number } {
  const page = PAGE_DIMENSIONS[pageSize]
  return orientation === 'portrait' ? { ...page } : { width: page.height, height: page.width }
}

export function keptEntriesLayoutPageCount(layout: KeptEntriesCanvasLayout): number {
  const numbers = [
    layout.pageCount ?? 1,
    ...layout.placements.map((placement) => placement.pageNumber ?? 1),
    ...(layout.images ?? []).map((placement) => placement.pageNumber)
  ].filter((value) => Number.isFinite(value) && value > 0)
  return Math.max(1, ...numbers)
}

/** Widens a stored version-1 layout to the current version without changing how it renders. */
export function upgradeKeptEntriesLayout(layout: KeptEntriesCanvasLayout): KeptEntriesCanvasLayout {
  if (layout.version === KEPT_ENTRIES_LAYOUT_VERSION) return layout
  return { ...layout, version: KEPT_ENTRIES_LAYOUT_VERSION, images: layout.images ?? [] }
}
