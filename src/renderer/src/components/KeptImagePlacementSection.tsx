import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, ImagePlus, LayoutGrid, Trash2 } from 'lucide-react'

import {
  planKeptEntryImagePlacements,
  type KeptImagePlan,
  type KeptImageSourceDescriptor
} from '../../../export'
import type { ProjectEntry } from '../../../shared/contracts'
import {
  keptEntriesPageDimensions,
  type KeptEntriesDivider,
  type KeptEntriesFontRef,
  type KeptEntriesOrientation,
  type KeptEntriesPageSize,
  type KeptImagePlacementOptions,
  type KeptImageRunningBalanceOptions
} from '../../../shared/keptEntriesLayout'
import {
  DEFAULT_KEPT_EXPORT_PAGE_NUMBERS,
  type KeptExportPageNumberAnchor,
  type KeptExportPageNumbers,
  type KeptExportRunningBalance
} from '../../../shared/keptExportTemplate'
import type { DetectedPageNumberMatch } from '../../../style'
import { pageNumberMatchToKeptExportPageNumbers } from '../../../style'
import { LengthField } from './LengthField'

export type KeptImageSourceMode = 'session-entry' | 'uploaded-png'

interface KeptImagePlacementSectionProps {
  pageSize: KeptEntriesPageSize
  orientation: KeptEntriesOrientation
  sessionSources?: readonly KeptImageSourceDescriptor[]
  keptEntries?: readonly ProjectEntry[]
  runningBalance?: KeptExportRunningBalance
  onPlaceImages: (plan: KeptImagePlan) => void
  /** Copies picked PNGs into project-owned storage and returns managed descriptors. */
  onUploadPngs?: (files: File[]) => Promise<KeptImageSourceDescriptor[]>
  /** Images already on the canvas, so preview is offered only once a plan has been applied. */
  placedImageCount?: number
  onPreviewPlacedImages?: () => void
  initialOptions?: KeptImagePlacementOptions
  initialUploadedSources?: readonly KeptImageSourceDescriptor[]
  onConfigurationChange?: (
    options: KeptImagePlacementOptions,
    uploadedSources: readonly KeptImageSourceDescriptor[]
  ) => void
  initialPageNumbers?: KeptExportPageNumbers
  onPageNumbersChange?: (pageNumbers: KeptExportPageNumbers) => void
  /** The wizard: scans the active source PDF for its existing page-number style. */
  onDetectPageNumbers?: () => Promise<DetectedPageNumberMatch | undefined>
}

interface PlacementOptions {
  startX: number
  startY: number
  endY: number
  fillBetweenY: boolean
  entriesPerPage: number
  gap: number
  /** null means derive the size from the image's natural dimensions. */
  width: number | null
  height: number | null
  preserveAspectRatio: boolean
  uniformSlots: boolean
  divider: KeptEntriesDivider
  runningBalance: KeptImageRunningBalanceOptions
}

const DEFAULT_HORIZONTAL_MARGIN = 48
const DEFAULT_VERTICAL_MARGIN = 72

const STANDARD_FONTS: Array<Extract<KeptEntriesFontRef, { kind: 'standard-14' }>['family']> = [
  'Helvetica',
  'Helvetica-Bold',
  'Times-Roman',
  'Courier'
]

const PAGE_NUMBER_ANCHORS: Array<{ value: KeptExportPageNumberAnchor; label: string }> = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-right', label: 'Bottom right' }
]

function createDefaultDivider(pageWidth: number): KeptEntriesDivider {
  const startX = DEFAULT_HORIZONTAL_MARGIN
  const endX = Math.max(startX + 1, pageWidth - DEFAULT_HORIZONTAL_MARGIN)
  return {
    enabled: false,
    startX,
    endX,
    width: endX - startX,
    thickness: 1,
    color: '#17231c',
    opacity: 0.35
  }
}

function createDefaultRunningBalance(): KeptImageRunningBalanceOptions {
  return {
    enabled: false,
    offsetX: 8,
    offsetY: 4,
    fontSize: 10,
    color: '#17231c'
  }
}

function createDefaultOptions(
  pageSize: KeptEntriesPageSize,
  orientation: KeptEntriesOrientation
): PlacementOptions {
  const page = keptEntriesPageDimensions(pageSize, orientation)
  const startY = DEFAULT_VERTICAL_MARGIN
  const endY = Math.max(startY + 1, page.height - DEFAULT_VERTICAL_MARGIN)

  return {
    startX: DEFAULT_HORIZONTAL_MARGIN,
    startY,
    endY,
    fillBetweenY: false,
    entriesPerPage: 6,
    gap: 12,
    width: null,
    height: null,
    preserveAspectRatio: true,
    uniformSlots: false,
    divider: createDefaultDivider(page.width),
    runningBalance: createDefaultRunningBalance()
  }
}

function numberValue(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function optionalDimension(value: number | null): number | undefined {
  return value !== null && Number.isFinite(value) && value > 0 ? value : undefined
}

export function KeptImagePlacementSection({
  pageSize,
  orientation,
  sessionSources = [],
  keptEntries = [],
  runningBalance,
  onPlaceImages,
  onUploadPngs,
  placedImageCount = 0,
  onPreviewPlacedImages,
  initialOptions,
  initialUploadedSources = [],
  onConfigurationChange,
  initialPageNumbers,
  onPageNumbersChange,
  onDetectPageNumbers
}: KeptImagePlacementSectionProps): React.JSX.Element {
  const [mode, setMode] = useState<KeptImageSourceMode>(
    initialOptions?.sourceMode ?? (sessionSources.length > 0 ? 'session-entry' : 'uploaded-png')
  )
  const [uploaded, setUploaded] = useState<KeptImageSourceDescriptor[]>(() => [
    ...initialUploadedSources
  ])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [options, setOptions] = useState<PlacementOptions>(() => {
    const defaults = createDefaultOptions(pageSize, orientation)
    return {
      ...defaults,
      ...initialOptions,
      width: initialOptions?.width ?? null,
      height: initialOptions?.height ?? null,
      divider: { ...defaults.divider, ...initialOptions?.divider },
      runningBalance: { ...defaults.runningBalance, ...initialOptions?.runningBalance }
    }
  })
  const inputRef = useRef<HTMLInputElement>(null)

  const [pageNumbers, setPageNumbers] = useState<KeptExportPageNumbers>(() => ({
    ...DEFAULT_KEPT_EXPORT_PAGE_NUMBERS,
    ...initialPageNumbers
  }))
  const [isDetectingPageNumbers, setIsDetectingPageNumbers] = useState(false)
  const [pageNumberDetectionStatus, setPageNumberDetectionStatus] = useState<string | null>(null)

  const updatePageNumbers = (
    update: (current: KeptExportPageNumbers) => KeptExportPageNumbers,
    matchesSource = false
  ): void => {
    setPageNumbers((current) => {
      const next = { ...update(current), matchSourceStyle: matchesSource }
      onPageNumbersChange?.(next)
      return next
    })
  }

  const detectPageNumbers = async (): Promise<void> => {
    if (!onDetectPageNumbers) return
    setIsDetectingPageNumbers(true)
    setPageNumberDetectionStatus('Scanning the source PDF for existing page numbers...')
    try {
      const match = await onDetectPageNumbers()
      if (!match) {
        setPageNumberDetectionStatus(
          'No confident page-number pattern was found on the source pages.'
        )
        return
      }
      updatePageNumbers(() => pageNumberMatchToKeptExportPageNumbers(match), true)
      setPageNumberDetectionStatus(
        `Matched "${match.format.template}" at ${match.anchor.replace('-', ' ')}.`
      )
    } finally {
      setIsDetectingPageNumbers(false)
    }
  }

  const placementOptions = useMemo<KeptImagePlacementOptions>(
    () => ({
      sourceMode: mode,
      startX: options.startX,
      startY: options.startY,
      endY: optionalDimension(options.endY),
      fillBetweenY: options.fillBetweenY,
      entriesPerPage: options.entriesPerPage,
      gap: options.gap,
      width: optionalDimension(options.width),
      height: optionalDimension(options.height),
      preserveAspectRatio: options.preserveAspectRatio,
      uniformSlots: options.uniformSlots,
      divider: { ...options.divider },
      runningBalance: { ...options.runningBalance }
    }),
    [mode, options]
  )

  useEffect(() => {
    onConfigurationChange?.(placementOptions, uploaded)
  }, [onConfigurationChange, placementOptions, uploaded])

  const hasSessionImages = sessionSources.length > 0
  const sources = mode === 'session-entry' ? sessionSources : uploaded

  const plan = useMemo<KeptImagePlan>(
    () => ({
      ...planKeptEntryImagePlacements(sources, {
        pageSize,
        orientation,
        ...placementOptions,
        entries: keptEntries.filter((entry) => entry.status === 'keep'),
        runningBalanceConfig: runningBalance
      }),
      options: placementOptions
    }),
    [orientation, pageSize, placementOptions, sources, keptEntries, runningBalance]
  )

  const setOption = <Key extends keyof PlacementOptions>(
    key: Key,
    value: PlacementOptions[Key]
  ): void => {
    setOptions((current) => ({ ...current, [key]: value }))
  }

  const setDivider = (patch: Partial<KeptEntriesDivider>): void => {
    setOptions((current) => ({ ...current, divider: { ...current.divider, ...patch } }))
  }

  const setRunningBalance = (patch: Partial<KeptImageRunningBalanceOptions>): void => {
    setOptions((current) => ({
      ...current,
      runningBalance: { ...current.runningBalance, ...patch }
    }))
  }

  const canPlace = plan.placements.length > 0

  return (
    <section className="kept-image-section" aria-labelledby="kept-image-section-title">
      <div className="kept-template-section-heading">
        <div>
          <span className="eyebrow">KEPT ENTRY IMAGES</span>
          <strong id="kept-image-section-title">Place entry images</strong>
        </div>
      </div>

      <fieldset className="kept-template-choice">
        <legend>Image source</legend>
        <label>
          <input
            type="radio"
            name="kept-image-source"
            checked={mode === 'session-entry'}
            disabled={!hasSessionImages}
            onChange={() => setMode('session-entry')}
          />
          Use PNG entries from this session ({sessionSources.length})
        </label>
        <label>
          <input
            type="radio"
            name="kept-image-source"
            checked={mode === 'uploaded-png'}
            onChange={() => setMode('uploaded-png')}
          />
          Upload PNG files ({uploaded.length})
        </label>
      </fieldset>

      {!hasSessionImages && (
        <p className="context-help">
          Keep at least one entry with a source region to place session images.
        </p>
      )}

      {mode === 'uploaded-png' && (
        <div className="kept-image-uploads">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/png"
            multiple
            aria-label="Choose PNG files to place"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ''
              if (files.length === 0 || !onUploadPngs) return
              setUploadError(null)
              setIsUploading(true)
              void onUploadPngs(files)
                .then((descriptors) => {
                  if (descriptors.length === 0) {
                    setUploadError('No PNG files could be copied into this project.')
                    return
                  }
                  setUploaded((current) => [
                    ...current,
                    ...descriptors.filter(
                      (descriptor) => !current.some((item) => item.ref === descriptor.ref)
                    )
                  ])
                })
                .catch((error: unknown) => {
                  setUploadError(error instanceof Error ? error.message : 'PNG upload failed.')
                })
                .finally(() => setIsUploading(false))
            }}
          />
          <button
            className="secondary-button"
            type="button"
            disabled={!onUploadPngs || isUploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus size={14} aria-hidden="true" />{' '}
            {isUploading ? 'Copying PNG files...' : 'Add PNG files'}
          </button>
          {uploaded.length > 0 && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => setUploaded([])}
              aria-label="Remove all uploaded PNG files"
            >
              <Trash2 size={14} aria-hidden="true" /> Clear
            </button>
          )}
          {uploadError && (
            <p className="kept-image-error" role="alert">
              {uploadError}
            </p>
          )}
        </div>
      )}

      <div className="kept-image-grid">
        <LengthField
          label="Start X"
          value={options.startX}
          onChange={(points) => setOption('startX', points)}
        />
        <LengthField
          label="Start Y"
          value={options.startY}
          onChange={(points) => setOption('startY', points)}
        />
        <LengthField
          label="End Y"
          value={options.endY}
          min={0}
          disabled={!options.fillBetweenY}
          onChange={(points) => setOption('endY', points)}
        />
        <label>
          <span>Entries per page</span>
          <input
            type="number"
            min={1}
            value={options.entriesPerPage}
            onChange={(event) => setOption('entriesPerPage', numberValue(event.target.value, 1))}
          />
        </label>
        <LengthField
          label="Vertical gap"
          value={options.gap}
          min={0}
          onChange={(points) => setOption('gap', points)}
        />
        <LengthField
          label="Width"
          optional
          placeholder="Auto"
          min={0}
          value={options.width}
          onChange={(points) => setOption('width', points)}
        />
        <LengthField
          label="Height"
          optional
          placeholder="Auto"
          min={0}
          value={options.height}
          onChange={(points) => setOption('height', points)}
        />
      </div>

      <div className="kept-image-toggles">
        <label>
          <input
            type="checkbox"
            checked={options.fillBetweenY}
            onChange={(event) => setOption('fillBetweenY', event.target.checked)}
          />
          Fill between Start Y and End Y
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.preserveAspectRatio}
            onChange={(event) => setOption('preserveAspectRatio', event.target.checked)}
          />
          Preserve aspect ratio
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.uniformSlots}
            onChange={(event) => setOption('uniformSlots', event.target.checked)}
          />
          Uniform crop dimensions
        </label>
      </div>

      <fieldset className="kept-image-balance" aria-labelledby="kept-image-balance-legend">
        <legend id="kept-image-balance-legend">Balance column</legend>
        <label className="kept-image-divider-toggle">
          <input
            type="checkbox"
            checked={options.runningBalance.enabled}
            onChange={(event) => setRunningBalance({ enabled: event.target.checked })}
          />
          Show running balance beside each session image
        </label>
        {options.runningBalance.enabled && (
          <p className="context-help">
            Opening balance and decimal places follow the Calculated balance settings in the kept
            text template.
          </p>
        )}
        <div className="kept-image-grid">
          <LengthField
            label="Horizontal offset"
            min={0}
            value={options.runningBalance.offsetX}
            disabled={!options.runningBalance.enabled}
            onChange={(offsetX) => setRunningBalance({ offsetX })}
          />
          <LengthField
            label="Vertical offset"
            min={0}
            value={options.runningBalance.offsetY}
            disabled={!options.runningBalance.enabled}
            onChange={(offsetY) => setRunningBalance({ offsetY })}
          />
          <label>
            <span>Font size</span>
            <input
              type="number"
              min="6"
              max="24"
              step="0.5"
              value={options.runningBalance.fontSize}
              disabled={!options.runningBalance.enabled}
              onChange={(event) =>
                setRunningBalance({ fontSize: numberValue(event.target.value, 10) })
              }
            />
          </label>
          <label>
            <span>Color</span>
            <input
              type="color"
              value={options.runningBalance.color}
              disabled={!options.runningBalance.enabled}
              onChange={(event) => setRunningBalance({ color: event.target.value })}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="kept-image-divider" aria-labelledby="kept-image-divider-legend">
        <legend id="kept-image-divider-legend">Entry divider</legend>
        <label className="kept-image-divider-toggle">
          <input
            type="checkbox"
            checked={options.divider.enabled}
            onChange={(event) => setDivider({ enabled: event.target.checked })}
          />
          Show a divider after every image
        </label>
        <div className="kept-image-grid">
          <LengthField
            label="Width"
            min={1}
            value={options.divider.width}
            disabled={!options.divider.enabled}
            onChange={(width) => setDivider({ width, endX: options.divider.startX + width })}
          />
          <LengthField
            label="Thickness"
            min={0.1}
            value={options.divider.thickness}
            disabled={!options.divider.enabled}
            onChange={(thickness) => setDivider({ thickness })}
          />
          <label>
            <span>Color</span>
            <input
              type="color"
              value={options.divider.color}
              disabled={!options.divider.enabled}
              onChange={(event) => setDivider({ color: event.target.value })}
            />
          </label>
          <label>
            <span>Opacity</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={options.divider.opacity}
              disabled={!options.divider.enabled}
              onChange={(event) =>
                setDivider({
                  opacity: Math.max(
                    0,
                    Math.min(1, numberValue(event.target.value, options.divider.opacity))
                  )
                })
              }
            />
          </label>
          <LengthField
            label="Start X"
            min={0}
            value={options.divider.startX}
            disabled={!options.divider.enabled}
            onChange={(startX) => setDivider({ startX, endX: startX + options.divider.width })}
          />
          <LengthField
            label="End X"
            min={0}
            value={options.divider.endX}
            disabled={!options.divider.enabled}
            onChange={(endX) => setDivider({ endX, width: endX - options.divider.startX })}
          />
        </div>
      </fieldset>

      <fieldset
        className="kept-image-page-numbers"
        aria-labelledby="kept-image-page-numbers-legend"
      >
        <legend id="kept-image-page-numbers-legend">Page numbers</legend>
        <label className="kept-image-divider-toggle">
          <input
            type="checkbox"
            checked={pageNumbers.enabled}
            onChange={(event) =>
              updatePageNumbers(
                (current) => ({ ...current, enabled: event.target.checked }),
                pageNumbers.matchSourceStyle && event.target.checked
              )
            }
          />
          Add page numbers
        </label>
        {onDetectPageNumbers && (
          <div className="kept-image-page-numbers-detect">
            <button
              className="secondary-button"
              type="button"
              disabled={isDetectingPageNumbers}
              onClick={() => void detectPageNumbers()}
            >
              {isDetectingPageNumbers ? 'Scanning source...' : 'Match source page numbers'}
            </button>
            {pageNumberDetectionStatus && (
              <span role="status" aria-live="polite">
                {pageNumberDetectionStatus}
              </span>
            )}
            {pageNumbers.enabled && pageNumbers.matchSourceStyle && !pageNumberDetectionStatus && (
              <span role="status">Matched from the source document.</span>
            )}
          </div>
        )}
        <div className="kept-image-grid">
          <label>
            <span>Position</span>
            <select
              value={pageNumbers.anchor}
              disabled={!pageNumbers.enabled}
              onChange={(event) =>
                updatePageNumbers((current) => ({
                  ...current,
                  anchor: event.target.value as KeptExportPageNumberAnchor
                }))
              }
            >
              {PAGE_NUMBER_ANCHORS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <LengthField
            label="Horizontal offset"
            value={pageNumbers.offsetX}
            disabled={!pageNumbers.enabled}
            onChange={(offsetX) => updatePageNumbers((current) => ({ ...current, offsetX }))}
          />
          <LengthField
            label="Vertical offset"
            min={0}
            value={pageNumbers.offsetY}
            disabled={!pageNumbers.enabled}
            onChange={(offsetY) => updatePageNumbers((current) => ({ ...current, offsetY }))}
          />
          <label>
            <span>Format</span>
            <input
              type="text"
              value={pageNumbers.format.template}
              disabled={!pageNumbers.enabled}
              placeholder="{n}"
              onChange={(event) =>
                updatePageNumbers((current) => ({
                  ...current,
                  format: { ...current.format, template: event.target.value }
                }))
              }
            />
          </label>
          <label>
            <span>Start at</span>
            <input
              type="number"
              step="1"
              value={pageNumbers.format.startAt}
              disabled={!pageNumbers.enabled}
              onChange={(event) =>
                updatePageNumbers((current) => ({
                  ...current,
                  format: {
                    ...current.format,
                    startAt: Math.trunc(numberValue(event.target.value, current.format.startAt))
                  }
                }))
              }
            />
          </label>
          <label>
            <span>Scale</span>
            <input
              type="number"
              min="0.1"
              max="5"
              step="0.1"
              value={pageNumbers.scale}
              disabled={!pageNumbers.enabled}
              onChange={(event) =>
                updatePageNumbers((current) => ({
                  ...current,
                  scale: Math.max(0.1, numberValue(event.target.value, current.scale))
                }))
              }
            />
          </label>
          <label>
            <span>Size</span>
            <input
              type="number"
              min="6"
              max="72"
              value={pageNumbers.textStyle.fontSize}
              disabled={!pageNumbers.enabled}
              onChange={(event) =>
                updatePageNumbers((current) => ({
                  ...current,
                  textStyle: {
                    ...current.textStyle,
                    fontSize: Math.max(6, Math.min(72, numberValue(event.target.value, 9)))
                  }
                }))
              }
            />
          </label>
          <label>
            <span>Color</span>
            <input
              type="color"
              value={pageNumbers.textStyle.color}
              disabled={!pageNumbers.enabled}
              onChange={(event) =>
                updatePageNumbers((current) => ({
                  ...current,
                  textStyle: { ...current.textStyle, color: event.target.value }
                }))
              }
            />
          </label>
          <label>
            <span>PDF font</span>
            <select
              value={
                pageNumbers.textStyle.fontRef.kind === 'standard-14'
                  ? pageNumbers.textStyle.fontRef.family
                  : ''
              }
              disabled={!pageNumbers.enabled}
              onChange={(event) => {
                const family = event.target.value as Extract<
                  KeptEntriesFontRef,
                  { kind: 'standard-14' }
                >['family']
                if (!family) return
                updatePageNumbers((current) => ({
                  ...current,
                  textStyle: { ...current.textStyle, fontRef: { kind: 'standard-14', family } }
                }))
              }}
            >
              {pageNumbers.textStyle.fontRef.kind === 'system' && (
                <option value="">System font</option>
              )}
              {STANDARD_FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <p className="kept-image-summary" role="status">
        {canPlace
          ? `${plan.placements.length} images across ${plan.pageCount} ${plan.pageCount === 1 ? 'page' : 'pages'}.`
          : 'No images are ready to place.'}
      </p>

      {plan.warnings.length > 0 && (
        <ul className="kept-image-warnings" aria-label="Image placement warnings">
          {plan.warnings.map((warning) => (
            <li key={`${warning.code}:${warning.placementId ?? warning.ref ?? 'general'}`}>
              {warning.message}
            </li>
          ))}
        </ul>
      )}

      <div className="kept-image-commands">
        <button
          className="secondary-button"
          type="button"
          disabled={!canPlace}
          onClick={() => onPlaceImages(plan)}
        >
          <LayoutGrid size={14} aria-hidden="true" /> Place images
        </button>
        {onPreviewPlacedImages && (
          <button
            className="secondary-button"
            type="button"
            disabled={placedImageCount === 0}
            onClick={onPreviewPlacedImages}
          >
            <Eye size={14} aria-hidden="true" /> Edit placed images
          </button>
        )}
      </div>
      {onPreviewPlacedImages && (
        <p className="kept-image-summary" role="status">
          {placedImageCount === 0
            ? 'Place images to edit them on the canvas.'
            : `${placedImageCount} ${placedImageCount === 1 ? 'image is' : 'images are'} on the canvas.`}
        </p>
      )}
    </section>
  )
}
