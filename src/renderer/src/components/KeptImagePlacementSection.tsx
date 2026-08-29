import React, { useMemo, useRef, useState } from 'react'
import { Eye, ImagePlus, LayoutGrid, Trash2 } from 'lucide-react'

import {
  planKeptEntryImagePlacements,
  type KeptImagePlan,
  type KeptImageSourceDescriptor
} from '../../../export'
import type { KeptEntriesOrientation, KeptEntriesPageSize } from '../../../shared/keptEntriesLayout'
import { LengthField } from './LengthField'

export type KeptImageSourceMode = 'session-entry' | 'uploaded-png'

interface KeptImagePlacementSectionProps {
  pageSize: KeptEntriesPageSize
  orientation: KeptEntriesOrientation
  sessionSources?: readonly KeptImageSourceDescriptor[]
  onPlaceImages: (plan: KeptImagePlan) => void
  /** Copies picked PNGs into project-owned storage and returns managed descriptors. */
  onUploadPngs?: (files: File[]) => Promise<KeptImageSourceDescriptor[]>
  /** Images already on the canvas, so preview is offered only once a plan has been applied. */
  placedImageCount?: number
  onPreviewPlacedImages?: () => void
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
}

const DEFAULT_OPTIONS: PlacementOptions = {
  startX: 48,
  startY: 48,
  endY: 744,
  fillBetweenY: false,
  entriesPerPage: 6,
  gap: 12,
  width: null,
  height: null,
  preserveAspectRatio: true,
  uniformSlots: false
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
  onPlaceImages,
  onUploadPngs,
  placedImageCount = 0,
  onPreviewPlacedImages
}: KeptImagePlacementSectionProps): React.JSX.Element {
  const [mode, setMode] = useState<KeptImageSourceMode>(
    sessionSources.length > 0 ? 'session-entry' : 'uploaded-png'
  )
  const [uploaded, setUploaded] = useState<KeptImageSourceDescriptor[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [options, setOptions] = useState<PlacementOptions>(DEFAULT_OPTIONS)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasSessionImages = sessionSources.length > 0
  const sources = mode === 'session-entry' ? sessionSources : uploaded

  const plan = useMemo<KeptImagePlan>(
    () =>
      planKeptEntryImagePlacements(sources, {
        pageSize,
        orientation,
        startX: options.startX,
        startY: options.startY,
        endY: options.endY,
        fillBetweenY: options.fillBetweenY,
        gap: options.gap,
        entriesPerPage: options.entriesPerPage,
        width: optionalDimension(options.width),
        height: optionalDimension(options.height),
        preserveAspectRatio: options.preserveAspectRatio,
        uniformSlots: options.uniformSlots
      }),
    [options, orientation, pageSize, sources]
  )

  const setOption = <Key extends keyof PlacementOptions>(
    key: Key,
    value: PlacementOptions[Key]
  ): void => {
    setOptions((current) => ({ ...current, [key]: value }))
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
            <Eye size={14} aria-hidden="true" /> Preview placed images
          </button>
        )}
      </div>
      {onPreviewPlacedImages && (
        <p className="kept-image-summary" role="status">
          {placedImageCount === 0
            ? 'Place images to preview them on the canvas.'
            : `${placedImageCount} ${placedImageCount === 1 ? 'image is' : 'images are'} on the canvas.`}
        </p>
      )}
    </section>
  )
}
