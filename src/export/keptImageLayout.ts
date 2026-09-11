import { mapFinancialEntry, type FinancialColumnMapping } from '../analysis'
import type { ProjectEntry } from '../shared/contracts'
import { resolveCurrencyCode } from '../shared/currencies'
import { formatCurrencyAmount } from '../shared/currencyFormat'
import {
  keptEntriesPageDimensions,
  type KeptEntriesCanvasLayout,
  type KeptEntriesOrientation,
  type KeptEntriesPageSize,
  type KeptImageFit,
  type KeptImagePlacement,
  type KeptImagePlacementOptions,
  type KeptImageSourceDescriptor,
  KEPT_ENTRIES_LAYOUT_VERSION
} from '../shared/keptEntriesLayout'
import {
  DEFAULT_KEPT_EXPORT_RUNNING_BALANCE,
  type KeptExportRunningBalance
} from '../shared/keptExportTemplate'
import { buildEntryImageCrops } from './entryImages'
import { buildRunningBalanceValues, type RunningBalanceInputRow } from './runningBalance'

export type { KeptImageSourceDescriptor } from '../shared/keptEntriesLayout'

export interface KeptImagePlanOptions {
  pageSize: KeptEntriesPageSize
  orientation: KeptEntriesOrientation
  startX: number
  startY: number
  endY?: number
  fillBetweenY?: boolean
  gap: number
  entriesPerPage: number
  width?: number
  height?: number
  /** Default true: a slot never distorts the image, it letterboxes it. */
  preserveAspectRatio?: boolean
  /** Give every slot the largest resolved width and height so the column stays regular. */
  uniformSlots?: boolean
  /** Optional running-balance text rendered beside session-entry images. */
  runningBalance?: KeptImagePlacementOptions['runningBalance']
  runningBalanceConfig?: KeptExportRunningBalance
  entries?: readonly ProjectEntry[]
  currencyCode?: Parameters<typeof resolveCurrencyCode>[0]
  idPrefix?: string
}

export type KeptImagePlanWarningCode =
  | 'no-sources'
  | 'invalid-dimensions'
  | 'invalid-page-capacity'
  | 'invalid-y-range'
  | 'out-of-bounds'

export interface KeptImagePlanWarning {
  code: KeptImagePlanWarningCode
  ref?: string
  placementId?: string
  message: string
}

export interface KeptImagePlan {
  placements: KeptImagePlacement[]
  pageCount: number
  warnings: KeptImagePlanWarning[]
  options?: KeptImagePlacementOptions
}

/**
 * Session images come straight from the kept-entry crop pipeline, so a batch never depends on a
 * previous folder export. Crop sizes are already uniform across kept entries. Callers may render
 * eagerly, so an unusable selection yields an empty list rather than an error.
 */
export function buildSessionKeptImageSources(
  entries: readonly ProjectEntry[]
): KeptImageSourceDescriptor[] {
  let crops: ReturnType<typeof buildEntryImageCrops>
  try {
    crops = buildEntryImageCrops(entries)
  } catch {
    return []
  }
  return crops.map((crop) => ({
    kind: 'session-entry' as const,
    ref: crop.entryId,
    entryId: crop.entryId,
    name: crop.fileName,
    naturalWidth: crop.width,
    naturalHeight: crop.height
  }))
}

function resolveSlot(
  source: KeptImageSourceDescriptor,
  options: KeptImagePlanOptions
): { width: number; height: number } | null {
  const explicitWidth = options.width && options.width > 0 ? options.width : undefined
  const explicitHeight = options.height && options.height > 0 ? options.height : undefined
  if (explicitWidth && explicitHeight) return { width: explicitWidth, height: explicitHeight }

  const naturalWidth = source.naturalWidth
  const naturalHeight = source.naturalHeight
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return null

  const ratio = naturalWidth / naturalHeight
  if (explicitWidth) return { width: explicitWidth, height: explicitWidth / ratio }
  if (explicitHeight) return { width: explicitHeight * ratio, height: explicitHeight }
  return { width: naturalWidth, height: naturalHeight }
}

function mappingForImageBalances(): FinancialColumnMapping {
  return {
    amountColumns: ['money-out', 'money-in', 'balance'],
    dateSource: 'detected-date',
    descriptionSource: 'detected-description',
    referenceSource: 'entry-notes',
    categorySource: 'entry-category'
  }
}

function resolveSessionRunningBalanceValues(options: {
  runningBalance?: KeptImagePlacementOptions['runningBalance']
  entries?: readonly ProjectEntry[]
  runningBalanceConfig?: KeptExportRunningBalance
  currencyCode?: Parameters<typeof resolveCurrencyCode>[0]
}): Map<string, string> | undefined {
  if (!options.runningBalance?.enabled || !options.entries) return undefined
  const runningBalance = {
    ...DEFAULT_KEPT_EXPORT_RUNNING_BALANCE,
    ...options.runningBalanceConfig
  }

  const mapping = mappingForImageBalances()
  const currencyCode = resolveCurrencyCode(options.currencyCode)
  const rows: RunningBalanceInputRow[] = options.entries.map((entry) => {
    const mapped = mapFinancialEntry(entry, mapping)
    return {
      entryId: entry.id,
      moneyIn: mapped?.moneyIn,
      moneyOut: mapped?.moneyOut,
      balance: mapped?.balance,
      financiallyMapped: mapped !== null
    }
  })
  const calculated = buildRunningBalanceValues(rows, runningBalance).values
  const decimalPlaces = Math.max(
    0,
    Math.min(
      6,
      Math.trunc(runningBalance.decimalPlaces ?? DEFAULT_KEPT_EXPORT_RUNNING_BALANCE.decimalPlaces)
    )
  )

  return new Map(
    [...calculated].map(([entryId, value]) => [
      entryId,
      formatCurrencyAmount(value, currencyCode, { decimalPlaces })
    ])
  )
}

export function planKeptEntryImagePlacements(
  sources: readonly KeptImageSourceDescriptor[],
  options: KeptImagePlanOptions
): KeptImagePlan {
  const warnings: KeptImagePlanWarning[] = []
  if (sources.length === 0) {
    warnings.push({ code: 'no-sources', message: 'There are no images to place.' })
    return { placements: [], pageCount: 1, warnings }
  }

  let perPage = Math.floor(options.entriesPerPage)
  if (!Number.isFinite(perPage) || perPage <= 0) {
    warnings.push({
      code: 'invalid-page-capacity',
      message: 'Entries per page must be a positive whole number; all images stay on page 1.'
    })
    perPage = sources.length
  }

  const fit: KeptImageFit = options.preserveAspectRatio === false ? 'stretch' : 'contain'
  const gap = Number.isFinite(options.gap) ? Math.max(0, options.gap) : 0
  const endY = options.fillBetweenY && Number.isFinite(options.endY) ? options.endY : undefined
  if (endY !== undefined && endY <= options.startY) {
    warnings.push({
      code: 'invalid-y-range',
      message: 'End Y must be greater than Start Y to fill the available vertical range.'
    })
  }
  const fillBetweenY = endY !== undefined && endY > options.startY
  const page = keptEntriesPageDimensions(options.pageSize, options.orientation)
  const prefix = options.idPrefix ?? 'kept-image'
  const runningBalanceTextByEntryId = resolveSessionRunningBalanceValues(options)

  const slots: { source: KeptImageSourceDescriptor; width: number; height: number }[] = []
  for (const source of sources) {
    const slot = resolveSlot(source, options)
    if (!slot) {
      warnings.push({
        code: 'invalid-dimensions',
        ref: source.ref,
        message: `${source.name ?? source.ref} has no usable size; set a width and a height to place it.`
      })
      continue
    }
    slots.push({ source, ...slot })
  }

  if (options.uniformSlots && slots.length > 0) {
    const width = Math.max(...slots.map((slot) => slot.width))
    const height = Math.max(...slots.map((slot) => slot.height))
    for (const slot of slots) {
      slot.width = width
      slot.height = height
    }
  }

  const placements: KeptImagePlacement[] = []
  let pageNumber = 1
  let indexOnPage = 0
  let y = options.startY
  slots.forEach((slot, index) => {
    const exceedsRange = fillBetweenY && indexOnPage > 0 && y + slot.height > endY
    if (indexOnPage === perPage || exceedsRange) {
      pageNumber += 1
      indexOnPage = 0
      y = options.startY
    }
    const placement: KeptImagePlacement = {
      id: `${prefix}-${index + 1}`,
      source: { kind: slot.source.kind, ref: slot.source.ref },
      entryId: slot.source.entryId,
      pageNumber,
      x: options.startX,
      y,
      width: slot.width,
      height: slot.height,
      fit,
      ...(slot.source.entryId && runningBalanceTextByEntryId?.get(slot.source.entryId)
        ? { runningBalanceText: runningBalanceTextByEntryId.get(slot.source.entryId) }
        : {})
    }
    if (
      placement.x < 0 ||
      placement.y < 0 ||
      placement.x + placement.width > page.width ||
      placement.y + placement.height > page.height
    ) {
      warnings.push({
        code: 'out-of-bounds',
        ref: placement.source.ref,
        placementId: placement.id,
        message: `${slot.source.name ?? placement.source.ref} does not fit inside page ${pageNumber}.`
      })
    }
    if (placement.runningBalanceText && options.runningBalance) {
      // Rough label width; enough to catch a balance pushed past the page edge and clipped away.
      const labelWidth = placement.runningBalanceText.length * options.runningBalance.fontSize * 0.6
      const labelLeft = placement.x + placement.width + options.runningBalance.offsetX
      if (labelLeft + labelWidth > page.width) {
        warnings.push({
          code: 'out-of-bounds',
          ref: placement.source.ref,
          placementId: placement.id,
          message: `The balance label for ${slot.source.name ?? placement.source.ref} starts at ${Math.round(labelLeft)}pt and runs past the ${Math.round(page.width)}pt page edge, so it is clipped. Reduce the image width, Start X, or the balance gap.`
        })
      }
    }
    placements.push(placement)
    y += slot.height + gap
    indexOnPage += 1
  })

  return { placements, pageCount: placements.length === 0 ? 1 : pageNumber, warnings }
}

/** Replaces the image placements of a layout and widens it to the current layout version. */
export function withKeptImagePlacements(
  layout: KeptEntriesCanvasLayout,
  plan: KeptImagePlan
): KeptEntriesCanvasLayout {
  const textPages = layout.placements.map((placement) => placement.pageNumber ?? 1)
  return {
    ...layout,
    version: KEPT_ENTRIES_LAYOUT_VERSION,
    images: plan.placements.map((placement) => ({ ...placement })),
    imagePlacementOptions: plan.options ?? layout.imagePlacementOptions,
    pageCount: Math.max(plan.pageCount, 1, ...textPages)
  }
}
