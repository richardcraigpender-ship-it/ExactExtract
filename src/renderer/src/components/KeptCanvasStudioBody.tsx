import React, { useCallback, useMemo, useState } from 'react'
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
import type { KeptExportRenderPlan, KeptExportTemplate } from '../../../shared/keptExportTemplate'
import {
  keptEntriesLayoutPageCount,
  keptEntriesPageDimensions,
  type KeptEntriesBackground,
  type KeptEntriesCanvasLayout,
  type KeptImagePlacement,
  type KeptImageSourceRef
} from '../../../shared/keptEntriesLayout'
import { CanvasBackgroundControls } from './CanvasBackgroundControls'
import { CanvasPagerControls, CanvasZoomControls } from './CanvasWorkspaceControls'
import { describeImageResolutionFailure } from '../lib/imageResolutionMessage'
import { ExportCanvas } from './ExportCanvas'
import { KeptEntriesExportPreview } from './KeptEntriesExportPreview'
import { KeptExportTemplateEditor } from './KeptExportTemplateEditor'
import { KeptImagePlacementSection } from './KeptImagePlacementSection'
import { buildSessionKeptImageSources, type KeptImagePlan } from '../../../export'
import { uploadProjectPngs } from '../lib/projectImageUploads'
import type { DocumentStyleProfile } from '../../../shared/contracts'
import type { DetectedPageNumberMatch } from '../../../style'
import type {
  KeptImagePlacementOptions,
  KeptImageSourceDescriptor
} from '../../../shared/keptEntriesLayout'
import { createKeptExportTemplateDraft, toKeptExportTemplate } from './keptExportTemplateDraft'

type ToolPanel = 'setup' | 'pages' | 'zoom' | 'place' | 'selection' | 'background'

interface KeptCanvasStudioBodyProps {
  entries: readonly ProjectEntry[]
  layout: KeptEntriesCanvasLayout
  initialMode: 'text' | 'png'
  keptExportTemplate?: KeptExportTemplate
  onTextTemplateChange?: (template: KeptExportTemplate) => void
  /** Template render plan; the text canvas draws from this so config edits match the final PDF. */
  textRenderPlan?: KeptExportRenderPlan
  onLayoutChange: (layout: KeptEntriesCanvasLayout) => void
  onClose: () => void
  onExport: () => void
  onReset?: () => void
  onOpenConfiguration?: () => void
  onOpenTextConfiguration?: () => void
  onOpenPngConfiguration?: () => void
  /** PNG configuration is hosted in this panel, so the studio owns these directly. */
  documents?: readonly { styleProfile?: DocumentStyleProfile }[]
  onPlaceKeptImages?: (plan: KeptImagePlan) => void
  onImagePlacementConfigurationChange?: (
    options: KeptImagePlacementOptions,
    uploadedSources: readonly KeptImageSourceDescriptor[]
  ) => void
  onDetectPageNumbers?: () => Promise<DetectedPageNumberMatch | undefined>
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
  onTextTemplateChange,
  textRenderPlan,
  onLayoutChange,
  onClose,
  onExport,
  onReset,
  onOpenConfiguration,
  onOpenTextConfiguration,
  onOpenPngConfiguration,
  documents = [],
  onPlaceKeptImages,
  onImagePlacementConfigurationChange,
  onDetectPageNumbers,
  onSwitchMode,
  isExporting = false,
  resolveImageSource,
  imageResolutionError,
  onRefreshImages,
  isRefreshingImages = false
}: KeptCanvasStudioBodyProps): React.JSX.Element {
  const [selectedImagePlacementId, setSelectedImagePlacementId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [studioMode, setStudioMode] = useState<'text' | 'png'>(initialMode)
  const [toolPanel, setToolPanel] = useState<ToolPanel>('setup')

  const images = layout.images ?? []
  const sessionImageSources = useMemo(() => buildSessionKeptImageSources(entries), [entries])
  const templatePages = textRenderPlan?.pages ?? []
  const pageCount =
    studioMode === 'text' && textRenderPlan
      ? Math.max(1, templatePages.length)
      : keptEntriesLayoutPageCount(layout)
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const resolutionMessage = describeImageResolutionFailure(imageResolutionError)
  const templatePage = templatePages.find((candidate) => candidate.pageNumber === currentPage)
  const imagesOnPage = images.filter((placement) => placement.pageNumber === currentPage).length
  const textOnPage = templatePage
    ? templatePage.placements.length
    : layout.placements.filter((placement) => (placement.pageNumber ?? 1) === currentPage).length
  const selectedImage =
    images.find((placement) => placement.id === selectedImagePlacementId) ?? null

  const balanceOptions = layout.imagePlacementOptions?.runningBalance
  const pageWidth = keptEntriesPageDimensions(layout.pageSize, layout.orientation).width
  const clippedBalanceCount = balanceOptions?.enabled
    ? images.filter((placement) => {
        if (placement.pageNumber !== currentPage || !placement.runningBalanceText) return false
        const labelWidth = placement.runningBalanceText.length * balanceOptions.fontSize * 0.6
        return placement.x + placement.width + balanceOptions.offsetX + labelWidth > pageWidth
      }).length
    : 0
  const balancesEnabledButMissing = Boolean(
    balanceOptions?.enabled &&
    imagesOnPage > 0 &&
    images.every((placement) => !placement.runningBalanceText)
  )

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

  const selectImageFromCanvas = (placementId: string): void => {
    setSelectedImagePlacementId(placementId)
    setToolPanel('place')
  }

  const openConfiguration =
    studioMode === 'text'
      ? (onOpenTextConfiguration ?? onOpenConfiguration)
      : (onOpenPngConfiguration ?? onOpenConfiguration)
  const textCanvasLayout =
    studioMode === 'text' && templatePage
      ? {
          ...layout,
          pageSize: templatePage.template.pageSize,
          orientation: templatePage.template.orientation,
          // Text templates and PNG boards have independent backgrounds.
          background: templatePage.template.background
        }
      : layout
  const availableTools = [
    { id: 'setup' as const, label: 'Setup', icon: Settings2 },
    { id: 'pages' as const, label: 'Pages', icon: Layers },
    { id: 'zoom' as const, label: 'Zoom', icon: ZoomIn },
    { id: 'place' as const, label: 'Place', icon: ListPlus },
    { id: 'selection' as const, label: 'Select', icon: MousePointer2 },
    { id: 'background' as const, label: 'Background', icon: Images }
  ]
  const tools =
    studioMode === 'text'
      ? availableTools.filter((tool) =>
          (['setup', 'pages', 'zoom'] as ToolPanel[]).includes(tool.id)
        )
      : availableTools
  // Switching modes can leave a tab selected that the new mode does not offer.
  const activeToolPanel = tools.some((tool) => tool.id === toolPanel) ? toolPanel : 'setup'
  const textTemplateDraft = createKeptExportTemplateDraft(keptExportTemplate)
  const updateTextTemplate = useCallback(
    (draft: ReturnType<typeof createKeptExportTemplateDraft>): void => {
      onTextTemplateChange?.(toKeptExportTemplate(draft))
    },
    [onTextTemplateChange]
  )

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
      onReset={studioMode === 'png' ? onReset : undefined}
      canvas={
        studioMode === 'text' ? (
          <ExportCanvas
            ariaLabel="Formatted text statement page preview"
            layout={textCanvasLayout}
            pageNumber={currentPage}
            zoom={zoom}
            showImages={false}
            templatePage={templatePage}
            templatePageNumbers={keptExportTemplate?.pageNumbers}
            templatePageCount={pageCount}
          />
        ) : (
          <>
            {resolutionMessage && (
              <p className="kept-canvas-image-error" role="status">
                {resolutionMessage}
              </p>
            )}
            {balancesEnabledButMissing && (
              <p className="kept-canvas-image-error" role="status">
                The balance column is on, but no placed image has a balance value yet. Open
                Configure PNG Snippet Board and run Place images to refresh them.
              </p>
            )}
            {clippedBalanceCount > 0 && (
              <p className="kept-canvas-image-error" role="status">
                {clippedBalanceCount} balance label
                {clippedBalanceCount === 1 ? '' : 's'} on this page start past the{' '}
                {Math.round(pageWidth)}pt page edge, so{' '}
                {clippedBalanceCount === 1 ? 'it is' : 'they are'} clipped. Reduce the image width,
                Start X, or the balance gap.
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
                className={activeToolPanel === id ? 'is-active' : ''}
                type="button"
                aria-pressed={activeToolPanel === id}
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
            aria-label={`${tools.find((tool) => tool.id === activeToolPanel)?.label ?? 'Tool'} options`}
          >
            {activeToolPanel === 'setup' &&
              (studioMode === 'text' ? (
                <KeptExportTemplateEditor
                  embedded
                  initialDraft={textTemplateDraft}
                  onDraftChange={updateTextTemplate}
                  onApply={updateTextTemplate}
                  onExport={updateTextTemplate}
                />
              ) : onPlaceKeptImages ? (
                <KeptImagePlacementSection
                  pageSize={layout.pageSize}
                  orientation={layout.orientation}
                  sessionSources={sessionImageSources}
                  keptEntries={entries}
                  documents={documents}
                  runningBalance={keptExportTemplate?.runningBalance}
                  onPlaceImages={onPlaceKeptImages}
                  onUploadPngs={uploadProjectPngs}
                  placedImageCount={images.length}
                  initialOptions={layout.imagePlacementOptions}
                  initialUploadedSources={layout.uploadedImageSources}
                  onConfigurationChange={onImagePlacementConfigurationChange}
                  initialPageNumbers={layout.pageNumbers}
                  onPageNumbersChange={(pageNumbers) => onLayoutChange({ ...layout, pageNumbers })}
                  onDetectPageNumbers={onDetectPageNumbers}
                />
              ) : (
                openConfiguration && (
                  <button
                    className="secondary-button preview-tool-button"
                    type="button"
                    onClick={openConfiguration}
                  >
                    <Settings2 size={14} aria-hidden="true" /> Configure PNG Snippet Board
                  </button>
                )
              ))}
            {activeToolPanel === 'pages' && (
              <>
                <CanvasPagerControls
                  currentPage={currentPage}
                  pageCount={pageCount}
                  onChange={setPage}
                />
                <p className="context-help" role="status">
                  {studioMode === 'text'
                    ? `${textOnPage} text placement${textOnPage === 1 ? '' : 's'} on this page.`
                    : `${imagesOnPage} image${imagesOnPage === 1 ? '' : 's'} on this page.`}
                </p>
              </>
            )}
            {activeToolPanel === 'zoom' && <CanvasZoomControls zoom={zoom} onChange={setZoom} />}
            {activeToolPanel === 'place' && (
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
            )}
            {activeToolPanel === 'selection' && (
              <>
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
              </>
            )}
            {activeToolPanel === 'background' && (
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
