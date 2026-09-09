import React, { useState } from 'react'
import {
  Images,
  Layers,
  ListPlus,
  MousePointer2,
  RefreshCw,
  Settings2,
  Trash2,
  ZoomIn
} from 'lucide-react'

import type { ProjectEntry } from '../../../shared/contracts'
import type {
  KeptExportRenderPlan,
  KeptExportTemplate,
  KeptExportTextStyle
} from '../../../shared/keptExportTemplate'
import {
  keptEntriesLayoutPageCount,
  type KeptEntriesBackground,
  type KeptEntriesCanvasLayout,
  type KeptEntryPlacement,
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
import { createKeptEntryPlacement } from './keptEntriesLayout'
import { PlacementFontToolbar } from './PlacementFontToolbar'

type ToolPanel = 'setup' | 'pages' | 'zoom' | 'place' | 'selection' | 'background'

interface KeptCanvasStudioBodyProps {
  entries: readonly ProjectEntry[]
  layout: KeptEntriesCanvasLayout
  initialMode: 'text' | 'png'
  keptExportTemplate?: KeptExportTemplate
  /** Template render plan; the text canvas draws from this so config edits match the final PDF. */
  textRenderPlan?: KeptExportRenderPlan
  onLayoutChange: (layout: KeptEntriesCanvasLayout) => void
  onClose: () => void
  onExport: () => void
  onReset?: () => void
  onOpenConfiguration?: () => void
  onOpenTextConfiguration?: () => void
  onOpenPngConfiguration?: () => void
  onSwitchMode?: () => void
  isExporting?: boolean
  resolveImageSource?: (source: KeptImageSourceRef) => string | undefined
  imageResolutionError?: string
  onRefreshImages?: () => void
  isRefreshingImages?: boolean
}

/** Shared body for both kept-canvas studio windows: toolbar, canvas, and per-mode panels. */
export function KeptCanvasStudioBody({
  entries,
  layout,
  initialMode,
  keptExportTemplate,
  textRenderPlan,
  onLayoutChange,
  onClose,
  onExport,
  onReset,
  onOpenConfiguration,
  onOpenTextConfiguration,
  onOpenPngConfiguration,
  onSwitchMode,
  isExporting = false,
  resolveImageSource,
  imageResolutionError,
  onRefreshImages,
  isRefreshingImages = false
}: KeptCanvasStudioBodyProps): React.JSX.Element {
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [selectedImagePlacementId, setSelectedImagePlacementId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(CANVAS_DEFAULT_ZOOM)
  const [studioMode, setStudioMode] = useState<'text' | 'png'>(initialMode)
  const [toolPanel, setToolPanel] = useState<ToolPanel>('setup')

  const images = layout.images ?? []
  const pageCount = keptEntriesLayoutPageCount(layout)
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const resolutionMessage = describeImageResolutionFailure(imageResolutionError)
  const textOnPage = layout.placements.filter(
    (placement) => (placement.pageNumber ?? 1) === currentPage
  ).length
  const imagesOnPage = images.filter((placement) => placement.pageNumber === currentPage).length
  const selectedPlacement =
    layout.placements.find((placement) => placement.id === selectedPlacementId) ?? null
  const selectedImage =
    images.find((placement) => placement.id === selectedImagePlacementId) ?? null
  const keptEntries = entries.filter((entry) => entry.status === 'keep')
  const placedEntryIds = new Set(
    layout.placements.flatMap((placement) => (placement.entryId ? [placement.entryId] : []))
  )

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
      images: images.map((placement) => (placement.id === next.id ? next : placement))
    })
  }

  const deleteSelected = (): void => {
    if (studioMode === 'text') {
      if (!selectedPlacement) return
      onLayoutChange({
        ...layout,
        placements: layout.placements.filter((placement) => placement.id !== selectedPlacement.id)
      })
      setSelectedPlacementId(null)
      return
    }
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

  const placeTextEntry = (entry: ProjectEntry): void => {
    const existing = layout.placements.find((placement) => placement.entryId === entry.id)
    if (existing) {
      setSelectedPlacementId(existing.id)
      setPage(existing.pageNumber ?? 1)
      return
    }
    const placementsOnPage = layout.placements.filter(
      (placement) => (placement.pageNumber ?? 1) === currentPage
    )
    const placement = {
      ...createKeptEntryPlacement(entry, placementsOnPage.length),
      pageNumber: currentPage
    }
    onLayoutChange({ ...layout, placements: [...layout.placements, placement] })
    setSelectedPlacementId(placement.id)
  }

  /** Canvas is the single source of truth: selecting on it highlights + reveals the list tab. */
  const selectPlacementFromCanvas = (placementId: string): void => {
    setSelectedPlacementId(placementId)
    setToolPanel('place')
  }
  const selectImageFromCanvas = (placementId: string): void => {
    setSelectedImagePlacementId(placementId)
    setToolPanel('place')
  }

  const openConfiguration =
    studioMode === 'text'
      ? (onOpenTextConfiguration ?? onOpenConfiguration)
      : (onOpenPngConfiguration ?? onOpenConfiguration)
  const templatePage = textRenderPlan?.pages.find((page) => page.pageNumber === currentPage)
  const textCanvasLayout =
    studioMode === 'text' && templatePage
      ? {
          ...layout,
          pageSize: templatePage.template.pageSize,
          orientation: templatePage.template.orientation,
          background: templatePage.template.background ?? layout.background
        }
      : layout
  const templateTextStyle: KeptExportTextStyle | undefined = keptExportTemplate
    ? (keptExportTemplate.pageOneTemplate.columns.find((column) => column.sourceField === 'payee')
        ?.textStyle ??
      keptExportTemplate.pageOneTemplate.columns.find((column) => column.sourceField === 'text')
        ?.textStyle ??
      keptExportTemplate.pageOneTemplate.columns[0]?.textStyle ??
      keptExportTemplate.pageOneTemplate.defaultTextStyle)
    : undefined

  const tools = [
    { id: 'setup' as const, label: 'Setup', icon: Settings2 },
    { id: 'pages' as const, label: 'Pages', icon: Layers },
    { id: 'zoom' as const, label: 'Zoom', icon: ZoomIn },
    { id: 'place' as const, label: 'Place', icon: ListPlus },
    { id: 'selection' as const, label: 'Select', icon: MousePointer2 },
    { id: 'background' as const, label: 'Background', icon: Images }
  ]

  return (
    <KeptEntriesExportPreview
      title="Canvas & layout studio"
      studioMode={studioMode}
      onSwitchMode={() => {
        if (onSwitchMode) {
          onSwitchMode()
          return
        }
        setStudioMode((current) => (current === 'text' ? 'png' : 'text'))
      }}
      isExporting={isExporting}
      onClose={onClose}
      onExport={onExport}
      onReset={onReset}
      canvas={
        studioMode === 'text' ? (
          <ExportCanvas
            ariaLabel="Formatted text statement page preview"
            layout={textCanvasLayout}
            pageNumber={currentPage}
            zoom={zoom}
            showImages={false}
            templatePage={templatePage}
            textStyleOverride={templatePage ? undefined : templateTextStyle}
            selectedPlacementId={selectedPlacementId}
            onSelectPlacement={templatePage ? undefined : selectPlacementFromCanvas}
            onPlacementChange={templatePage ? undefined : replacePlacement}
            onBackgroundChange={changeBackground}
          />
        ) : (
          <>
            {resolutionMessage && (
              <p className="kept-canvas-image-error" role="status">
                {resolutionMessage}
              </p>
            )}
            <ExportCanvas
              ariaLabel="PNG snippet board page preview"
              layout={layout}
              pageNumber={currentPage}
              zoom={zoom}
              showText={false}
              selectedImagePlacementId={selectedImagePlacementId}
              resolveImageSource={resolveImageSource}
              onSelectImagePlacement={selectImageFromCanvas}
              onImagePlacementChange={replaceImage}
              onBackgroundChange={changeBackground}
            />
          </>
        )
      }
      contextPanel={
        <div className="preview-tool-stack kept-preview-tool-panel">
          <div className="kept-preview-tool-picker" role="toolbar" aria-label="Preview tools">
            {tools.map(({ id, label, icon: ToolIcon }) => (
              <button
                key={id}
                className={toolPanel === id ? 'is-active' : ''}
                type="button"
                aria-pressed={toolPanel === id}
                onClick={() => setToolPanel(id)}
                title={label}
              >
                <ToolIcon size={15} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div
            className="kept-preview-tool-options"
            aria-label={`${tools.find((tool) => tool.id === toolPanel)?.label ?? 'Tool'} options`}
          >
            {toolPanel === 'setup' && (
              <>
                {openConfiguration && (
                  <button
                    className="secondary-button preview-tool-button"
                    type="button"
                    onClick={openConfiguration}
                  >
                    <Settings2 size={14} aria-hidden="true" />{' '}
                    {studioMode === 'text'
                      ? 'Configure Formatted Text Statement'
                      : 'Configure PNG Snippet Board'}
                  </button>
                )}
                <p className="context-help">
                  Open the current preview mode setup, or switch tools above for page, zoom, place,
                  selection, and background controls.
                </p>
              </>
            )}
            {toolPanel === 'pages' && (
              <>
                <CanvasPagerControls
                  currentPage={currentPage}
                  pageCount={pageCount}
                  onChange={setPage}
                />
                <p className="context-help" role="status">
                  {studioMode === 'text'
                    ? `${textOnPage} text box${textOnPage === 1 ? '' : 'es'} on this page.`
                    : `${imagesOnPage} image${imagesOnPage === 1 ? '' : 's'} on this page.`}
                </p>
              </>
            )}
            {toolPanel === 'zoom' && <CanvasZoomControls zoom={zoom} onChange={setZoom} />}
            {toolPanel === 'place' &&
              (studioMode === 'text' ? (
                <section className="studio-place-panel" aria-label="Place kept entries">
                  <p className="context-help">
                    Template rows flow automatically, so kept entries are always rendered. Click an
                    entry to jump to it on the canvas.
                  </p>
                  <ul className="export-entries-list">
                    {keptEntries.map((entry) => {
                      const placement = layout.placements.find(
                        (candidate) => candidate.entryId === entry.id
                      )
                      const onCanvas = placement !== undefined || placedEntryIds.has(entry.id)
                      return (
                        <li
                          className={`export-entry-item ${onCanvas ? 'is-placed' : ''} ${
                            placement && placement.id === selectedPlacementId ? 'is-selected' : ''
                          }`}
                          key={entry.id}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (placement) {
                                setSelectedPlacementId(placement.id)
                                setPage(placement.pageNumber ?? 1)
                              } else {
                                placeTextEntry(entry)
                              }
                            }}
                          >
                            <span className="export-entry-text">{entry.normalizedText}</span>
                            <span className="export-entry-status">
                              {onCanvas ? 'On canvas' : 'Not placed'}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                    {keptEntries.length === 0 && (
                      <li className="export-entries-empty">No kept entries to place yet.</li>
                    )}
                  </ul>
                </section>
              ) : (
                <section className="studio-place-panel" aria-label="Placed images">
                  {images.length === 0 ? (
                    <p className="context-help">
                      Place PNG snapshots from the setup panel, then select one here to edit it.
                    </p>
                  ) : (
                    <ul className="studio-image-list">
                      {images.map((placement) => {
                        const src = resolveImageSource?.(placement.source)
                        const label = placement.entryId ?? placement.source.ref
                        return (
                          <li key={placement.id}>
                            <button
                              type="button"
                              className={`studio-image-thumb ${
                                placement.id === selectedImagePlacementId ? 'is-selected' : ''
                              }`}
                              aria-pressed={placement.id === selectedImagePlacementId}
                              onClick={() => {
                                setSelectedImagePlacementId(placement.id)
                                setPage(placement.pageNumber)
                              }}
                            >
                              {src ? (
                                <img src={src} alt={label} />
                              ) : (
                                <span className="studio-image-thumb-fallback">{label}</span>
                              )}
                              <span className="studio-image-thumb-label">
                                {label} · page {placement.pageNumber}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              ))}
            {toolPanel === 'selection' && (
              <>
                {studioMode === 'png' && (
                  <button
                    className="secondary-button preview-tool-button"
                    type="button"
                    disabled={!onRefreshImages || isRefreshingImages}
                    onClick={onRefreshImages}
                  >
                    <RefreshCw size={14} aria-hidden="true" />{' '}
                    {isRefreshingImages ? 'Refreshing images…' : 'Refresh PNG snapshots'}
                  </button>
                )}
                <button
                  className="secondary-button preview-tool-button"
                  type="button"
                  disabled={studioMode === 'text' ? !selectedPlacement : !selectedImage}
                  onClick={deleteSelected}
                >
                  <Trash2 size={14} aria-hidden="true" /> Delete selected
                </button>
                {studioMode === 'text' ? (
                  <PlacementFontToolbar placement={selectedPlacement} onChange={replacePlacement} />
                ) : (
                  <p className="context-help">
                    {selectedImage
                      ? `${selectedImage.entryId ?? selectedImage.source.ref} is selected. Drag it on the canvas or use its corner handle to resize.`
                      : 'Select a PNG to move or resize it.'}
                  </p>
                )}
              </>
            )}
            {toolPanel === 'background' && (
              <CanvasBackgroundControls
                background={layout.background}
                defaultWidth={612}
                defaultHeight={792}
                onChange={changeBackground}
              />
            )}
          </div>
        </div>
      }
    />
  )
}
