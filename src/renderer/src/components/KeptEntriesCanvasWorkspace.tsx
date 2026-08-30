import React, { useState } from 'react'
import { RotateCcw, Trash2, ZoomIn, ZoomOut } from 'lucide-react'

import type { ProjectEntry } from '../../../shared/contracts'
import {
  keptEntriesLayoutPageCount,
  type KeptEntriesBackground,
  type KeptEntriesCanvasLayout,
  type KeptEntryPlacement,
  type KeptImagePlacement,
  type KeptImageSourceRef
} from '../../../shared/keptEntriesLayout'
import { CanvasBackgroundControls } from './CanvasBackgroundControls'
import { describeImageResolutionFailure } from '../lib/imageResolutionMessage'
import { ExportCanvas } from './ExportCanvas'
import { ExportEntriesPanel } from './ExportEntriesPanel'
import { KeptEntriesExportPreview } from './KeptEntriesExportPreview'
import { PlacementFontToolbar } from './PlacementFontToolbar'

interface KeptEntriesCanvasWorkspaceProps {
  entries: readonly ProjectEntry[]
  layout: KeptEntriesCanvasLayout
  onLayoutChange: (layout: KeptEntriesCanvasLayout) => void
  onClose: () => void
  onExport: () => void
  onReset?: () => void
  isExporting?: boolean
  resolveImageSource?: (source: KeptImageSourceRef) => string | undefined
  imageResolutionError?: string
}

export function KeptEntriesCanvasWorkspace({
  entries,
  layout,
  onLayoutChange,
  onClose,
  onExport,
  onReset,
  isExporting = false,
  resolveImageSource,
  imageResolutionError
}: KeptEntriesCanvasWorkspaceProps): React.JSX.Element {
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [selectedImagePlacementId, setSelectedImagePlacementId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(0.7)
  const [previewMode, setPreviewMode] = useState<'combined' | 'text' | 'images'>(() =>
    (layout.images?.length ?? 0) > 0 ? 'images' : 'text'
  )

  const pageCount = keptEntriesLayoutPageCount(layout)
  const resolutionMessage = describeImageResolutionFailure(imageResolutionError)
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const selectedPlacement =
    layout.placements.find((placement) => placement.id === selectedPlacementId) ?? null
  const selectedImage =
    (layout.images ?? []).find((placement) => placement.id === selectedImagePlacementId) ?? null

  const replacePlacement = (next: KeptEntryPlacement): void => {
    onLayoutChange({
      ...layout,
      placements: layout.placements.map((placement) =>
        placement.id === next.id ? next : placement
      )
    })
  }

  const replaceImage = (next: KeptImagePlacement): void => {
    onLayoutChange({
      ...layout,
      images: (layout.images ?? []).map((placement) =>
        placement.id === next.id ? next : placement
      )
    })
  }

  const deleteSelected = (): void => {
    if (selectedImage) {
      onLayoutChange({
        ...layout,
        images: (layout.images ?? []).filter((placement) => placement.id !== selectedImage.id)
      })
      setSelectedImagePlacementId(null)
      return
    }
    if (!selectedPlacement) return
    onLayoutChange({
      ...layout,
      placements: layout.placements.filter((placement) => placement.id !== selectedPlacement.id)
    })
    setSelectedPlacementId(null)
  }

  const changeBackground = (background: KeptEntriesBackground | undefined): void => {
    onLayoutChange({ ...layout, background })
  }

  return (
    <KeptEntriesExportPreview
      isExporting={isExporting}
      onClose={onClose}
      onExport={onExport}
      onReset={onReset}
      entriesPanel={
        <ExportEntriesPanel entries={entries} placements={layout.placements} allowCanvasDrag />
      }
      canvas={
        <>
          {resolutionMessage && (
            <p className="kept-canvas-image-error" role="status">
              {resolutionMessage}
            </p>
          )}
          <ExportCanvas
            layout={layout}
            pageNumber={currentPage}
            zoom={zoom}
            previewMode={previewMode}
            selectedPlacementId={selectedPlacementId}
            selectedImagePlacementId={selectedImagePlacementId}
            resolveImageSource={resolveImageSource}
            onSelectPlacement={(placementId) => {
              setSelectedImagePlacementId(null)
              setSelectedPlacementId(placementId)
            }}
            onSelectImagePlacement={(placementId) => {
              setSelectedPlacementId(null)
              setSelectedImagePlacementId(placementId)
            }}
            onPlacementChange={replacePlacement}
            onImagePlacementChange={replaceImage}
            onBackgroundChange={changeBackground}
          />
        </>
      }
      contextPanel={
        <>
          <div className="kept-canvas-pager" aria-label="Canvas pages">
            <button
              className="secondary-button"
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous page
            </button>
            <span role="status">
              Page {currentPage} of {pageCount}
            </span>
            <button
              className="secondary-button"
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Next page
            </button>
          </div>
          <div className="kept-canvas-preview-mode" role="group" aria-label="Canvas preview mode">
            <button
              className="secondary-button"
              type="button"
              aria-pressed={previewMode === 'images'}
              onClick={() => setPreviewMode('images')}
            >
              PNG images
            </button>
            <button
              className="secondary-button"
              type="button"
              aria-pressed={previewMode === 'text'}
              onClick={() => setPreviewMode('text')}
            >
              Kept text
            </button>
            <button
              className="secondary-button"
              type="button"
              aria-pressed={previewMode === 'combined'}
              onClick={() => setPreviewMode('combined')}
            >
              Combined
            </button>
          </div>
          <div className="kept-canvas-zoom" aria-label="Canvas zoom">
            <button
              className="icon-button"
              type="button"
              title="Zoom out"
              aria-label="Zoom out"
              disabled={zoom <= 0.5}
              onClick={() => setZoom((current) => Math.max(0.5, current - 0.1))}
            >
              <ZoomOut size={15} aria-hidden="true" />
            </button>
            <span role="status">{Math.round(zoom * 100)}%</span>
            <button
              className="icon-button"
              type="button"
              title="Zoom in"
              aria-label="Zoom in"
              disabled={zoom >= 2}
              onClick={() => setZoom((current) => Math.min(2, current + 0.1))}
            >
              <ZoomIn size={15} aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              type="button"
              title="Reset canvas zoom"
              aria-label="Reset canvas zoom"
              disabled={zoom === 1}
              onClick={() => setZoom(1)}
            >
              <RotateCcw size={15} aria-hidden="true" />
            </button>
          </div>
          <button
            className="secondary-button"
            type="button"
            disabled={!selectedPlacement && !selectedImage}
            onClick={deleteSelected}
          >
            <Trash2 size={14} aria-hidden="true" /> Delete selected
          </button>
          {selectedImage ? (
            <p className="context-help">
              {selectedImage.entryId ?? selectedImage.source.ref} is selected. Drag it on the canvas
              or use its corner handle to resize.
            </p>
          ) : (
            <PlacementFontToolbar placement={selectedPlacement} onChange={replacePlacement} />
          )}
          <CanvasBackgroundControls
            background={layout.background}
            defaultWidth={612}
            defaultHeight={792}
            onChange={changeBackground}
          />
        </>
      }
    />
  )
}
