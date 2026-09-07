import React, { useState } from 'react'
import { Images, RefreshCw, Settings2, Trash2 } from 'lucide-react'

import type { ProjectEntry } from '../../../shared/contracts'
import {
  keptEntriesLayoutPageCount,
  type KeptEntriesBackground,
  type KeptEntriesCanvasLayout,
  type KeptImagePlacement,
  type KeptImageSourceRef
} from '../../../shared/keptEntriesLayout'
import { CanvasBackgroundControls } from './CanvasBackgroundControls'
import {
  CANVAS_DEFAULT_ZOOM,
  CanvasPagerControls,
  CanvasZoomControls
} from './CanvasWorkspaceControls'
import { describeImageResolutionFailure } from '../lib/imageResolutionMessage'
import { ExportCanvas } from './ExportCanvas'
import { KeptEntriesExportPreview } from './KeptEntriesExportPreview'

interface KeptPngCanvasWorkspaceProps {
  entries: readonly ProjectEntry[]
  layout: KeptEntriesCanvasLayout
  onLayoutChange: (layout: KeptEntriesCanvasLayout) => void
  onClose: () => void
  onExport: () => void
  onReset?: () => void
  onOpenConfiguration?: () => void
  isExporting?: boolean
  resolveImageSource?: (source: KeptImageSourceRef) => string | undefined
  imageResolutionError?: string
  onRefreshImages?: () => void
  isRefreshingImages?: boolean
}

export function KeptPngCanvasWorkspace({
  entries,
  layout,
  onLayoutChange,
  onClose,
  onExport,
  onReset,
  onOpenConfiguration,
  isExporting = false,
  resolveImageSource,
  imageResolutionError,
  onRefreshImages,
  isRefreshingImages = false
}: KeptPngCanvasWorkspaceProps): React.JSX.Element {
  const [selectedImagePlacementId, setSelectedImagePlacementId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(CANVAS_DEFAULT_ZOOM)

  const images = layout.images ?? []
  const pageCount = keptEntriesLayoutPageCount(layout)
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const resolutionMessage = describeImageResolutionFailure(imageResolutionError)
  const imagesOnPage = images.filter((placement) => placement.pageNumber === currentPage).length
  const selectedImage =
    images.find((placement) => placement.id === selectedImagePlacementId) ?? null
  const keptCount = entries.filter((entry) => entry.status === 'keep').length

  const replaceImage = (next: KeptImagePlacement): void => {
    onLayoutChange({
      ...layout,
      images: images.map((placement) => (placement.id === next.id ? next : placement))
    })
  }

  const deleteSelected = (): void => {
    if (!selectedImage) return
    onLayoutChange({
      ...layout,
      images: images.filter((placement) => placement.id !== selectedImage.id)
    })
    setSelectedImagePlacementId(null)
  }

  const changeBackground = (background: KeptEntriesBackground | undefined): void => {
    onLayoutChange({ ...layout, background })
  }

  return (
    <KeptEntriesExportPreview
      title="Kept PNG layout preview"
      entriesLabel="Placed PNG images"
      isExporting={isExporting}
      onClose={onClose}
      onExport={onExport}
      onReset={onReset}
      entriesPanel={
        <section className="export-entries-panel" aria-labelledby="kept-png-list-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PLACED IMAGES</span>
              <strong id="kept-png-list-title">
                {images.length} image{images.length === 1 ? '' : 's'}
              </strong>
            </div>
          </div>
          {images.length === 0 ? (
            <p className="context-help">
              {keptCount === 0
                ? 'Keep at least one entry, then use Configure kept PNG layout to place images.'
                : 'Use Configure kept PNG layout to place images on this canvas.'}
            </p>
          ) : (
            <ul className="export-entries-list">
              {images.map((placement) => (
                <li
                  className={`export-entry-item ${
                    selectedImagePlacementId === placement.id ? 'is-placed' : ''
                  }`}
                  key={placement.id}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImagePlacementId(placement.id)
                      setPage(placement.pageNumber)
                    }}
                  >
                    <Images size={13} aria-hidden="true" />{' '}
                    {placement.entryId ?? placement.source.ref} (page {placement.pageNumber})
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      }
      canvas={
        <>
          {resolutionMessage && (
            <p className="kept-canvas-image-error" role="status">
              {resolutionMessage}
            </p>
          )}
          <ExportCanvas
            ariaLabel="Kept PNG layout page preview"
            layout={layout}
            pageNumber={currentPage}
            zoom={zoom}
            showText={false}
            selectedImagePlacementId={selectedImagePlacementId}
            resolveImageSource={resolveImageSource}
            onSelectImagePlacement={setSelectedImagePlacementId}
            onImagePlacementChange={replaceImage}
            onBackgroundChange={changeBackground}
          />
        </>
      }
      contextPanel={
        <>
          <div className="preview-tool-stack">
            <button
              className="secondary-button preview-tool-button"
              type="button"
              onClick={onOpenConfiguration}
            >
              <Settings2 size={14} aria-hidden="true" /> Configure PNG layout
            </button>
            <CanvasPagerControls currentPage={currentPage} pageCount={pageCount} onChange={setPage} />
            <p className="context-help" role="status">
              {imagesOnPage} image{imagesOnPage === 1 ? '' : 's'} on this page.
            </p>
            <CanvasZoomControls zoom={zoom} onChange={setZoom} />
            <button
              className="secondary-button preview-tool-button"
              type="button"
              disabled={!onRefreshImages || isRefreshingImages}
              onClick={onRefreshImages}
            >
              <RefreshCw size={14} aria-hidden="true" />{' '}
              {isRefreshingImages ? 'Refreshing images…' : 'Refresh PNG snapshots'}
            </button>
            <button
              className="secondary-button preview-tool-button"
              type="button"
              disabled={!selectedImage}
              onClick={deleteSelected}
            >
              <Trash2 size={14} aria-hidden="true" /> Delete selected
            </button>
            <p className="context-help">
              {selectedImage
                ? `${selectedImage.entryId ?? selectedImage.source.ref} is selected. Drag it on the canvas or use its corner handle to resize.`
                : 'Select a PNG to move or resize it.'}
            </p>
            <CanvasBackgroundControls
              background={layout.background}
              defaultWidth={612}
              defaultHeight={792}
              onChange={changeBackground}
            />
          </div>
        </>
      }
    />
  )
}
