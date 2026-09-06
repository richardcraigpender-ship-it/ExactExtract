import React, { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Download, Eye, FileJson, FileText, FileOutput, Images, Table } from 'lucide-react'
import {
  buildSessionKeptImageSources,
  type ExportSnapshot,
  type KeptImagePlan
} from '../../../export'
import type { ProjectEntry } from '../../../shared/contracts'
import type {
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

export type PdfExportFormat =
  | 'pdf'
  | 'pdf-layout'
  | 'pdf-compact'
  | 'pdf-kept'
  | 'pdf-kept-layout'
  | 'pdf-kept-canvas'
  | 'pdf-kept-template'

interface ExportPanelProps {
  snapshot: ExportSnapshot
  status: string
  isSaving: boolean
  onSave: (
    format:
      | 'csv'
      | 'json'
      | 'pdf'
      | 'pdf-layout'
      | 'pdf-compact'
      | 'pdf-kept'
      | 'pdf-kept-layout'
      | 'pdf-kept-canvas'
      | 'entry-images'
  ) => void
  rowHeight?: string
  onRowHeightChange?: (value: string) => void
  selectedEntryId?: string | null
  onSelectEntry?: (entryId: string) => void
  onPreview?: (format: PdfExportFormat) => Promise<Uint8Array>
  keptEntries?: readonly ProjectEntry[]
  onTemplateExport?: (template: KeptExportTemplate) => void
  onTemplatePreview?: (template: KeptExportTemplate) => Promise<Uint8Array>
  keptExportTemplate?: KeptExportTemplate
  onTemplateApply?: (template: KeptExportTemplate) => void
  currencySymbol?: string
  onPlaceKeptImages?: (plan: KeptImagePlan) => void
  onOpenKeptCanvas?: () => void
  placedImageCount?: number
  onPreviewPlacedImages?: () => void
  imagePlacementOptions?: KeptImagePlacementOptions
  uploadedImageSources?: readonly KeptImageSourceDescriptor[]
  onImagePlacementConfigurationChange?: (
    options: KeptImagePlacementOptions,
    uploadedSources: readonly KeptImageSourceDescriptor[]
  ) => void
  keptImagePageNumbers?: KeptExportPageNumbers
  onKeptImagePageNumbersChange?: (pageNumbers: KeptExportPageNumbers) => void
  onDetectPageNumbers?: () => Promise<DetectedPageNumberMatch | undefined>
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
  onTemplatePreview,
  keptExportTemplate,
  onTemplateApply,
  currencySymbol = '£',
  onPlaceKeptImages,
  onOpenKeptCanvas,
  placedImageCount,
  onPreviewPlacedImages,
  imagePlacementOptions,
  uploadedImageSources,
  onImagePlacementConfigurationChange,
  keptImagePageNumbers,
  onKeptImagePageNumbersChange,
  onDetectPageNumbers
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
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [showImageLayoutEditor, setShowImageLayoutEditor] = useState(false)
  const [templateDraft, setTemplateDraft] = useState<KeptExportTemplateDraft>(() =>
    createKeptExportTemplateDraft(keptExportTemplate)
  )
  const latestTemplateDraftRef = useRef(templateDraft)
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

  return (
    <aside className="export-panel" aria-label="Export reviewed project">
      <div className="export-actions">
        <section className="export-action-group" aria-label="Reviewed export">
          <span className="export-action-group-label">Reviewed export</span>
          <div className="export-primary-actions">
            {onPreview && (
              <div className="export-preview-command">
                <select
                  aria-label="PDF format to preview"
                  value={previewFormat}
                  onChange={(event) => setPreviewFormat(event.target.value as PdfExportFormat)}
                >
                  <option value="pdf">Reviewed PDF</option>
                  <option value="pdf-layout">Source layout</option>
                  <option value="pdf-compact">Compact layout</option>
                  <option value="pdf-kept">Kept entries</option>
                  <option value="pdf-kept-layout">Kept original layout</option>
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
            <button
              className="primary-button"
              type="button"
              disabled={isSaving}
              onClick={() => onSave('pdf')}
            >
              <FileText size={13} /> Save PDF
            </button>
            {onTemplateExport && (
              <button
                className="secondary-button"
                type="button"
                disabled={isSaving || keptEntries.length === 0}
                onClick={() => {
                  const draft = createKeptExportTemplateDraft(keptExportTemplate)
                  latestTemplateDraftRef.current = draft
                  setTemplateDraft(draft)
                  setShowTemplateEditor(true)
                }}
              >
                <FileOutput size={13} /> Configure kept text export
              </button>
            )}
            {templateStatus && (
              <span className="export-inline-status" role="status" aria-live="polite">
                {templateStatus}
              </span>
            )}
            {onPlaceKeptImages && (
              <button
                className="secondary-button"
                type="button"
                disabled={isSaving}
                onClick={() => setShowImageLayoutEditor(true)}
              >
                <Images size={13} /> Configure kept PNG layout
              </button>
            )}
            {onOpenKeptCanvas && (
              <button
                className="secondary-button"
                type="button"
                disabled={isSaving || keptEntries.length === 0}
                onClick={onOpenKeptCanvas}
              >
                <Images size={13} /> Edit layout canvas
              </button>
            )}
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
        <details className="export-more-actions">
          <summary>More PDF formats</summary>
          <div>
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving}
              onClick={() => onSave('pdf-layout')}
              title="Copy the original PDF pages and mark reviewed rows at their source positions"
            >
              <FileOutput size={13} /> Source layout
            </button>
            <label className="export-row-height">
              <span>Compact row height</span>
              <input
                type="number"
                min="1"
                step="0.5"
                value={rowHeight}
                onChange={(event) => onRowHeightChange(event.target.value)}
              />
            </label>
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving || !Number.isFinite(Number(rowHeight)) || Number(rowHeight) <= 0}
              onClick={() => onSave('pdf-compact')}
            >
              <FileOutput size={13} /> Compact PDF
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving}
              onClick={() => onSave('pdf-kept')}
            >
              <FileOutput size={13} /> Kept entries
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving}
              onClick={() => onSave('pdf-kept-layout')}
            >
              <FileOutput size={13} /> Kept original layout
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving}
              onClick={() => onSave('pdf-kept-canvas')}
            >
              <FileOutput size={13} /> Save placed-image PDF
            </button>
          </div>
        </details>
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
          title="Configure kept text export"
          className="workspace-tool-window--kept-template"
          onClose={() => {
            applyTemplateDraft(latestTemplateDraftRef.current)
            setShowTemplateEditor(false)
          }}
        >
          <KeptExportTemplateEditor
            initialDraft={templateDraft}
            onDraftChange={(draft) => {
              latestTemplateDraftRef.current = draft
            }}
            onDetectPageNumbers={onDetectPageNumbers}
            onCancel={() => setShowTemplateEditor(false)}
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
              if (!onTemplatePreview) return
              setPreviewError(null)
              setTemplateStatus('Generating kept text preview...')
              setIsPreviewing(true)
              void onTemplatePreview(toKeptExportTemplate(draft))
                .then((data) => {
                  setPreviewData(data)
                  setTemplateStatus(
                    autoCloseTemplateEditor
                      ? 'Kept text preview generated.'
                      : 'Kept text preview generated. Close this window to view it.'
                  )
                  if (autoCloseTemplateEditor) setShowTemplateEditor(false)
                })
                .catch((error: unknown) =>
                  setPreviewError(
                    error instanceof Error
                      ? error.message
                      : 'Unable to generate the kept-text preview.'
                  )
                )
                .finally(() => setIsPreviewing(false))
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
          title="Configure kept PNG layout"
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
            onPreviewPlacedImages={onPreviewPlacedImages ?? onOpenKeptCanvas ?? (() => undefined)}
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
