import React, { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Download, Eye, FileJson, FileOutput, Images, Table } from 'lucide-react'
import {
  buildSessionKeptImageSources,
  type ExportSnapshot,
  type KeptImagePlan
} from '../../../export'
import type { ProjectEntry } from '../../../shared/contracts'
import type {
  KeptEntriesBackground,
  KeptImagePlacementOptions,
  KeptImageSourceDescriptor
} from '../../../shared/keptEntriesLayout'
import { ExportPreview } from './ExportPreview'
import { uploadProjectPngs } from '../lib/projectImageUploads'
import { WorkspaceToolWindow } from './WorkspaceToolWindow'
import { KeptImageLayoutEditor } from './KeptImageLayoutEditor'
import { KeptExportTemplateEditor } from './KeptExportTemplateEditor'
import {
  cloneKeptExportTemplateDraft,
  createKeptExportTemplateDraft,
  toKeptExportTemplate,
  type KeptExportTemplateDraft
} from './keptExportTemplateDraft'
import type { KeptExportPageNumbers, KeptExportTemplate } from '../../../shared/keptExportTemplate'
import type { DetectedPageNumberMatch } from '../../../style'

const PdfViewer = lazy(async () => {
  const module = await import('./PdfViewer')
  return { default: module.PdfViewer }
})

export type PdfExportFormat = 'pdf' | 'pdf-kept-canvas' | 'pdf-kept-template'

interface ExportPanelProps {
  snapshot: ExportSnapshot
  status: string
  isSaving: boolean
  onSave: (format: 'csv' | 'json' | 'pdf' | 'pdf-kept-canvas' | 'entry-images') => void
  rowHeight?: string
  onRowHeightChange?: (value: string) => void
  selectedEntryId?: string | null
  onSelectEntry?: (entryId: string) => void
  onPreview?: (format: PdfExportFormat) => Promise<Uint8Array>
  keptEntries?: readonly ProjectEntry[]
  onTemplateExport?: (template: KeptExportTemplate) => void
  onOpenKeptTemplateCanvas?: (template: KeptExportTemplate) => void
  keptExportTemplate?: KeptExportTemplate
  onTemplateApply?: (template: KeptExportTemplate) => void
  currencySymbol?: string
  onPlaceKeptImages?: (plan: KeptImagePlan) => void
  onOpenKeptCanvas?: () => void
  onOpenKeptTextCanvas?: () => void
  onPreviewPlacedImages?: () => void
  placedImageCount?: number
  imagePlacementOptions?: KeptImagePlacementOptions
  uploadedImageSources?: readonly KeptImageSourceDescriptor[]
  onImagePlacementConfigurationChange?: (
    options: KeptImagePlacementOptions,
    uploadedSources: readonly KeptImageSourceDescriptor[]
  ) => void
  keptImagePageNumbers?: KeptExportPageNumbers
  onKeptImagePageNumbersChange?: (pageNumbers: KeptExportPageNumbers) => void
  onDetectPageNumbers?: () => Promise<DetectedPageNumberMatch | undefined>
  /** Offered to the template editor as an explicit copy source; the two stay separate fields. */
  canvasBackground?: KeptEntriesBackground
  initialTemplateEditorOpen?: boolean
  initialImageLayoutEditorOpen?: boolean
  onConfigurationEditorClosed?: () => void
}

export const ExportPanel = React.memo(function ExportPanel({
  snapshot,
  status,
  isSaving,
  onSave,
  rowHeight = '18',
  onRowHeightChange = () => undefined,
  selectedEntryId,
  onSelectEntry,
  onPreview,
  keptEntries = [],
  onTemplateExport,
  onOpenKeptTemplateCanvas,
  keptExportTemplate,
  onTemplateApply,
  currencySymbol = '£',
  onPlaceKeptImages,
  onOpenKeptCanvas,
  onOpenKeptTextCanvas,
  onPreviewPlacedImages,
  placedImageCount,
  imagePlacementOptions,
  uploadedImageSources,
  onImagePlacementConfigurationChange,
  keptImagePageNumbers,
  onKeptImagePageNumbersChange,
  onDetectPageNumbers,
  canvasBackground,
  initialTemplateEditorOpen = false,
  initialImageLayoutEditorOpen = false,
  onConfigurationEditorClosed
}: ExportPanelProps): React.JSX.Element {
  const [previewFormat, setPreviewFormat] = useState<PdfExportFormat>('pdf')
  const [previewData, setPreviewData] = useState<Uint8Array | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [templateStatus, setTemplateStatus] = useState<string | null>(null)
  const [autoCloseTemplateEditor, setAutoCloseTemplateEditor] = useState(
    () =>
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('studio-kept-template-auto-close') === 'true'
  )
  const [showTemplateEditor, setShowTemplateEditor] = useState(initialTemplateEditorOpen)
  const [showImageLayoutEditor, setShowImageLayoutEditor] = useState(initialImageLayoutEditorOpen)
  const [templateDraft, setTemplateDraft] = useState<KeptExportTemplateDraft>(() =>
    createKeptExportTemplateDraft(keptExportTemplate)
  )
  const latestTemplateDraftRef = useRef(templateDraft)

  React.useEffect(() => {
    setShowTemplateEditor(initialTemplateEditorOpen)
  }, [initialTemplateEditorOpen])

  React.useEffect(() => {
    setShowImageLayoutEditor(initialImageLayoutEditorOpen)
  }, [initialImageLayoutEditorOpen])
  const sessionImageSources = useMemo(
    () => buildSessionKeptImageSources(keptEntries),
    [keptEntries]
  )
  const applyTemplateDraft = (draft: KeptExportTemplateDraft): void => {
    const savedDraft = cloneKeptExportTemplateDraft(draft)
    latestTemplateDraftRef.current = savedDraft
    setTemplateDraft(savedDraft)
    onTemplateApply?.(toKeptExportTemplate(savedDraft))
    setTemplateStatus('Kept text export template applied.')
  }
  const changeAutoCloseTemplateEditor = (value: boolean): void => {
    setAutoCloseTemplateEditor(value)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('studio-kept-template-auto-close', String(value))
    }
  }
  void rowHeight
  void onRowHeightChange

  return (
    <aside className="export-panel" aria-label="Export reviewed project">
      <div className="export-actions">
        <section className="export-action-group" aria-label="Data exports">
          <span className="export-action-group-label">Data exports</span>
          <div className="export-primary-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving}
              onClick={() => onSave('csv')}
            >
              <Table size={13} /> Save CSV
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving}
              onClick={() => onSave('json')}
            >
              <FileJson size={13} /> Save JSON
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving || snapshot.summary.keptCount === 0}
              onClick={() => onSave('entry-images')}
              title="Create a folder of fixed-size PNG crops, sized to the largest kept source region so nothing is clipped"
            >
              <Images size={13} /> Save kept entry PNGs
            </button>
          </div>
        </section>
        <section className="export-action-group" aria-label="Layout and PDF studio">
          <span className="export-action-group-label">Layout &amp; PDF studio</span>
          <div className="export-primary-actions">
            {(onOpenKeptTextCanvas || onOpenKeptCanvas) && (
              <button
                className="secondary-button"
                type="button"
                disabled={isSaving || keptEntries.length === 0}
                onClick={() => {
                  if (onOpenKeptTextCanvas) {
                    onOpenKeptTextCanvas()
                    return
                  }
                  onOpenKeptCanvas?.()
                }}
              >
                <FileOutput size={13} /> Formatted PDF Statement
              </button>
            )}
            {onOpenKeptCanvas && (
              <button
                className="secondary-button"
                type="button"
                disabled={isSaving || keptEntries.length === 0}
                onClick={onOpenKeptCanvas}
              >
                <Images size={13} /> PNG Snippet Board
              </button>
            )}
            {templateStatus && (
              <span className="export-inline-status" role="status" aria-live="polite">
                {templateStatus}
              </span>
            )}
            {onPreview && (
              <div className="export-preview-command">
                <select
                  aria-label="PDF format to preview"
                  value={previewFormat}
                  onChange={(event) => setPreviewFormat(event.target.value as PdfExportFormat)}
                >
                  <option value="pdf">Reviewed PDF</option>
                  <option value="pdf-kept-canvas">Final placed-image PDF</option>
                  <option value="pdf-kept-template" disabled={!keptExportTemplate}>
                    Kept text template
                  </option>
                </select>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={isSaving || isPreviewing}
                  onClick={async () => {
                    setIsPreviewing(true)
                    setPreviewError(null)
                    try {
                      setPreviewData(await onPreview(previewFormat))
                    } catch (error: unknown) {
                      setPreviewError(
                        error instanceof Error ? error.message : 'Unable to generate the preview.'
                      )
                    } finally {
                      setIsPreviewing(false)
                    }
                  }}
                >
                  <Eye size={13} /> {isPreviewing ? 'Generating…' : 'Preview PDF'}
                </button>
              </div>
            )}
            {previewError && !showTemplateEditor && (
              <p className="kept-template-errors" role="alert">
                {previewError}
              </p>
            )}
          </div>
        </section>
        <span role="status">
          <Download size={12} aria-hidden="true" /> {status}
        </span>
      </div>
      <ExportPreview
        snapshot={snapshot}
        selectedEntryId={selectedEntryId}
        onSelectEntry={onSelectEntry}
      />
      {previewData && (
        <WorkspaceToolWindow
          title="Final PDF preview"
          className="workspace-tool-window--pdf-preview"
          onClose={() => setPreviewData(null)}
        >
          <div className="export-pdf-preview">
            <Suspense fallback={<div className="viewer-message">Loading preview…</div>}>
              <PdfViewer
                data={previewData}
                fileName={`${snapshot.project.name} preview`}
                initialZoom={0.8}
              />
            </Suspense>
          </div>
        </WorkspaceToolWindow>
      )}
      {showTemplateEditor && onTemplateExport && (
        <WorkspaceToolWindow
          title="Formatted PDF Statement"
          className="workspace-tool-window--kept-template"
          onClose={() => {
            applyTemplateDraft(latestTemplateDraftRef.current)
            setShowTemplateEditor(false)
            onConfigurationEditorClosed?.()
          }}
        >
          <KeptExportTemplateEditor
            initialDraft={templateDraft}
            onDraftChange={(draft) => {
              latestTemplateDraftRef.current = draft
            }}
            onDetectPageNumbers={onDetectPageNumbers}
            canvasBackground={canvasBackground}
            onCancel={() => {
              setShowTemplateEditor(false)
              onConfigurationEditorClosed?.()
            }}
            onApply={(draft) => {
              applyTemplateDraft(draft)
              if (autoCloseTemplateEditor) setShowTemplateEditor(false)
            }}
            onExport={(draft) => {
              applyTemplateDraft(draft)
              onTemplateExport(toKeptExportTemplate(draft))
              if (autoCloseTemplateEditor) setShowTemplateEditor(false)
            }}
            onPreview={(draft) => {
              applyTemplateDraft(draft)
              setShowTemplateEditor(false)
              onConfigurationEditorClosed?.()
              onOpenKeptTemplateCanvas?.(toKeptExportTemplate(draft))
            }}
            isExporting={isSaving}
            isPreviewing={isPreviewing}
            autoCloseAfterAction={autoCloseTemplateEditor}
            onAutoCloseAfterActionChange={changeAutoCloseTemplateEditor}
            actionStatus={templateStatus}
            currencySymbol={currencySymbol}
          />
          {previewError && (
            <p className="kept-template-errors" role="alert">
              {previewError}
            </p>
          )}
        </WorkspaceToolWindow>
      )}
      {showImageLayoutEditor && onPlaceKeptImages && (
        <WorkspaceToolWindow
          title="PNG Snippet Board"
          className="workspace-tool-window--kept-image-layout"
          onClose={() => setShowImageLayoutEditor(false)}
        >
          <KeptImageLayoutEditor
            pageSize={templateDraft.pageOneTemplate.pageSize}
            orientation={templateDraft.pageOneTemplate.orientation}
            sessionImageSources={sessionImageSources}
            keptEntries={keptEntries}
            runningBalance={templateDraft.runningBalance}
            placedImageCount={placedImageCount ?? 0}
            onPlaceImages={onPlaceKeptImages}
            onUploadPngs={uploadProjectPngs}
            onPreviewPlacedImages={onPreviewPlacedImages ?? (() => undefined)}
            onClose={() => setShowImageLayoutEditor(false)}
            initialOptions={imagePlacementOptions}
            initialUploadedSources={uploadedImageSources}
            onConfigurationChange={onImagePlacementConfigurationChange ?? (() => undefined)}
            initialPageNumbers={keptImagePageNumbers}
            onPageNumbersChange={onKeptImagePageNumbersChange}
            onDetectPageNumbers={onDetectPageNumbers}
          />
        </WorkspaceToolWindow>
      )}
    </aside>
  )
})
