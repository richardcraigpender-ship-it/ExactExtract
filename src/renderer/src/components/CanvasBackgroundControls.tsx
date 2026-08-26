import React, { useRef } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import type { KeptEntriesBackground } from '../../../shared/keptEntriesLayout'

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
            onChange({
              dataUrl: reader.result,
              x: 0,
              y: 0,
              width: defaultWidth,
              height: defaultHeight,
              opacity: 1
            })
          }
          reader.readAsDataURL(file)
          event.target.value = ''
        }}
      />
      {background ? (
        <div className="canvas-background-editor">
          <div className="canvas-background-preview">
            <img src={background.dataUrl} alt="Selected canvas background" />
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
            {(['x', 'y', 'width', 'height'] as const).map((field) => (
              <label key={field}>
                <span>{field === 'x' || field === 'y' ? field.toUpperCase() : field}</span>
                <input
                  type="number"
                  min={field === 'width' || field === 'height' ? 16 : 0}
                  value={background[field]}
                  onChange={(event) =>
                    onChange({
                      ...background,
                      [field]: Math.max(
                        field === 'width' || field === 'height' ? 16 : 0,
                        Number(event.target.value) || 0
                      )
                    })
                  }
                />
              </label>
            ))}
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
