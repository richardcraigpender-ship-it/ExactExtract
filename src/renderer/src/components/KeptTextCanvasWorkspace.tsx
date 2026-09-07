import React, { useState } from 'react'
import { Settings2, Trash2 } from 'lucide-react'

import type { ProjectEntry } from '../../../shared/contracts'
import {
  keptEntriesLayoutPageCount,
  type KeptEntriesBackground,
  type KeptEntriesCanvasLayout,
  type KeptEntryPlacement
} from '../../../shared/keptEntriesLayout'
import { CanvasBackgroundControls } from './CanvasBackgroundControls'
import {
  CANVAS_DEFAULT_ZOOM,
  CanvasPagerControls,
  CanvasZoomControls
} from './CanvasWorkspaceControls'
import { ExportCanvas } from './ExportCanvas'
import { ExportEntriesPanel } from './ExportEntriesPanel'
import { KeptEntriesExportPreview } from './KeptEntriesExportPreview'
import { createKeptEntryPlacement } from './keptEntriesLayout'
import { PlacementFontToolbar } from './PlacementFontToolbar'

interface KeptTextCanvasWorkspaceProps {
  entries: readonly ProjectEntry[]
  layout: KeptEntriesCanvasLayout
  onLayoutChange: (layout: KeptEntriesCanvasLayout) => void
  onClose: () => void
  onExport: () => void
  onReset?: () => void
  onOpenConfiguration?: () => void
  isExporting?: boolean
}

export function KeptTextCanvasWorkspace({
  entries,
  layout,
  onLayoutChange,
  onClose,
  onExport,
  onReset,
  onOpenConfiguration,
  isExporting = false
}: KeptTextCanvasWorkspaceProps): React.JSX.Element {
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(CANVAS_DEFAULT_ZOOM)

  const pageCount = keptEntriesLayoutPageCount(layout)
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const textOnPage = layout.placements.filter(
    (placement) => (placement.pageNumber ?? 1) === currentPage
  ).length
  const selectedPlacement =
    layout.placements.find((placement) => placement.id === selectedPlacementId) ?? null

  const replacePlacement = (next: KeptEntryPlacement): void => {
    onLayoutChange({
      ...layout,
      placements: layout.placements.map((placement) =>
        placement.id === next.id ? next : placement
      )
    })
  }

  const deleteSelected = (): void => {
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

  return (
    <KeptEntriesExportPreview
      title="Kept text layout preview"
      entriesLabel="Kept entries list"
      isExporting={isExporting}
      onClose={onClose}
      onExport={onExport}
      onReset={onReset}
      entriesPanel={
        <ExportEntriesPanel
          entries={entries}
          placements={layout.placements}
          allowCanvasDrag
          onPlaceEntry={placeTextEntry}
        />
      }
      canvas={
        <ExportCanvas
          ariaLabel="Kept text layout page preview"
          layout={layout}
          pageNumber={currentPage}
          zoom={zoom}
          showImages={false}
          selectedPlacementId={selectedPlacementId}
          onSelectPlacement={setSelectedPlacementId}
          onPlacementChange={replacePlacement}
          onBackgroundChange={changeBackground}
        />
      }
      contextPanel={
        <>
          <div className="preview-tool-stack">
            <button
              className="secondary-button preview-tool-button"
              type="button"
              onClick={onOpenConfiguration}
            >
              <Settings2 size={14} aria-hidden="true" /> Configure text export
            </button>
            <CanvasPagerControls currentPage={currentPage} pageCount={pageCount} onChange={setPage} />
            <p className="context-help" role="status">
              {textOnPage} text box{textOnPage === 1 ? '' : 'es'} on this page.
            </p>
            <CanvasZoomControls zoom={zoom} onChange={setZoom} />
            <button
              className="secondary-button preview-tool-button"
              type="button"
              disabled={!selectedPlacement}
              onClick={deleteSelected}
            >
              <Trash2 size={14} aria-hidden="true" /> Delete selected
            </button>
            <PlacementFontToolbar placement={selectedPlacement} onChange={replacePlacement} />
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
