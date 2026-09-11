import React, { useRef, useState } from 'react'
import { ImagePlus, Maximize2, Minus, Plus, Trash2 } from 'lucide-react'
import type { KeptEntriesBackground } from '../../../shared/keptEntriesLayout'
import {
  fitBackgroundToPage,
  MIN_BACKGROUND_SIZE,
  resizeBackgroundEdge,
  scaleBackground
} from '../lib/canvasBackground'
import { resolveBackgroundUrl, storeBackgroundImage } from '../lib/canvasBackgroundStorage'
import { LengthField } from './LengthField'

const SCALE_STEP = 0.1

interface CanvasBackgroundControlsProps {
  background?: KeptEntriesBackground
  onChange: (background: KeptEntriesBackground | undefined) => void
  label?: string
  defaultWidth?: number
  defaultHeight?: number
}

export function CanvasBackgroundControls({
  background,
  onChange,
  label = 'Background image',
  defaultWidth = 612,
  defaultHeight = 792
}: CanvasBackgroundControlsProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [lockAspectRatio, setLockAspectRatio] = useState(true)
  const [storeError, setStoreError] = useState<string | null>(null)
  const previewUrl = background ? resolveBackgroundUrl(background) : undefined

  const selectImage = (): void => {
    inputRef.current?.click()
  }

  return (
    <section className="canvas-background-controls" aria-labelledby="canvas-background-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CANVAS BACKGROUND</span>
          <strong id="canvas-background-title">{label}</strong>
        </div>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result !== 'string') return
            setStoreError(null)
            void storeBackgroundImage(reader.result, {
              x: 0,
              y: 0,
              width: defaultWidth,
              height: defaultHeight,
              opacity: 1,
              sharpness: 100
            })
              .then(onChange)
              .catch((error: unknown) =>
                setStoreError(
                  error instanceof Error ? error.message : 'The background could not be stored.'
                )
              )
          }
          reader.readAsDataURL(file)
          event.target.value = ''
        }}
      />
      {storeError && (
        <p className="kept-image-error" role="alert">
          {storeError}
        </p>
      )}
      {background ? (
        <div className="canvas-background-editor">
          <div className="canvas-background-preview">
            <img src={previewUrl} alt="Selected canvas background" />
            <button
              className="icon-button"
              type="button"
              title="Replace background image"
              onClick={selectImage}
            >
              <ImagePlus size={16} aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              type="button"
              title="Remove background image"
              onClick={() => onChange(undefined)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="canvas-background-fields">
            <LengthField
              label="X"
              value={background.x}
              min={0}
              onChange={(points) => onChange({ ...background, x: Math.max(0, points) })}
            />
            <LengthField
              label="Y"
              value={background.y}
              min={0}
              onChange={(points) => onChange({ ...background, y: Math.max(0, points) })}
            />
            <LengthField
              label="Width"
              value={background.width}
              min={MIN_BACKGROUND_SIZE}
              onChange={(points) =>
                onChange(resizeBackgroundEdge(background, 'width', points, lockAspectRatio))
              }
            />
            <LengthField
              label="Height"
              value={background.height}
              min={MIN_BACKGROUND_SIZE}
              onChange={(points) =>
                onChange(resizeBackgroundEdge(background, 'height', points, lockAspectRatio))
              }
            />
            <label>
              <span>Opacity</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={background.opacity}
                onChange={(event) =>
                  onChange({ ...background, opacity: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <span>Sharpness</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={background.sharpness ?? 100}
                onChange={(event) =>
                  onChange({ ...background, sharpness: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <div className="canvas-background-scale">
            <label className="canvas-background-lock">
              <input
                type="checkbox"
                checked={lockAspectRatio}
                onChange={(event) => setLockAspectRatio(event.target.checked)}
              />
              <span>Lock aspect ratio</span>
            </label>
            <button
              className="icon-button"
              type="button"
              title="Scale background down"
              aria-label="Scale background down"
              onClick={() => onChange(scaleBackground(background, 1 - SCALE_STEP))}
            >
              <Minus size={15} aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              type="button"
              title="Scale background up"
              aria-label="Scale background up"
              onClick={() => onChange(scaleBackground(background, 1 + SCALE_STEP))}
            >
              <Plus size={15} aria-hidden="true" />
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onChange(fitBackgroundToPage(background, defaultWidth, defaultHeight))}
            >
              <Maximize2 size={14} aria-hidden="true" /> Fit to page
            </button>
          </div>
        </div>
      ) : (
        <button className="secondary-button" type="button" onClick={selectImage}>
          <ImagePlus size={15} aria-hidden="true" /> Add background image
        </button>
      )}
      <p className="context-help">
        Background images are stored in this layout and can be repositioned on the canvas.
      </p>
    </section>
  )
}
