import React from 'react'
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'

export const CANVAS_MIN_ZOOM = 0.5
export const CANVAS_MAX_ZOOM = 2
export const CANVAS_DEFAULT_ZOOM = 0.7

interface CanvasPagerControlsProps {
  currentPage: number
  pageCount: number
  onChange: (page: number) => void
}

export function CanvasPagerControls({
  currentPage,
  pageCount,
  onChange
}: CanvasPagerControlsProps): React.JSX.Element {
  return (
    <div className="kept-canvas-pager kept-canvas-toolbar" aria-label="Canvas pages">
      <button
        className="secondary-button tool-button"
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onChange(currentPage - 1)}
      >
        Previous
      </button>
      <span role="status">
        {currentPage}/{pageCount}
      </span>
      <button
        className="secondary-button tool-button"
        type="button"
        disabled={currentPage >= pageCount}
        onClick={() => onChange(currentPage + 1)}
      >
        Next
      </button>
    </div>
  )
}

interface CanvasZoomControlsProps {
  zoom: number
  onChange: (zoom: number) => void
}

export function CanvasZoomControls({ zoom, onChange }: CanvasZoomControlsProps): React.JSX.Element {
  return (
    <div className="kept-canvas-zoom kept-canvas-toolbar" aria-label="Canvas zoom">
      <button
        className="icon-button tool-button"
        type="button"
        title="Zoom out"
        aria-label="Zoom out"
        disabled={zoom <= CANVAS_MIN_ZOOM}
        onClick={() => onChange(Math.max(CANVAS_MIN_ZOOM, zoom - 0.1))}
      >
        <ZoomOut size={15} aria-hidden="true" />
      </button>
      <span role="status">{Math.round(zoom * 100)}%</span>
      <button
        className="icon-button tool-button"
        type="button"
        title="Zoom in"
        aria-label="Zoom in"
        disabled={zoom >= CANVAS_MAX_ZOOM}
        onClick={() => onChange(Math.min(CANVAS_MAX_ZOOM, zoom + 0.1))}
      >
        <ZoomIn size={15} aria-hidden="true" />
      </button>
      <button
        className="icon-button tool-button"
        type="button"
        title="Reset canvas zoom"
        aria-label="Reset canvas zoom"
        disabled={zoom === 1}
        onClick={() => onChange(1)}
      >
        <RotateCcw size={15} aria-hidden="true" />
      </button>
    </div>
  )
}
