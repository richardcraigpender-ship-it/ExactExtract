import React, { lazy, Suspense, useMemo, useState } from 'react'
import { Download, Eye, FileJson, FileText, FileOutput, Images, Table } from 'lucide-react'
import {
  buildSessionKeptImageSources,
  type ExportSnapshot,
  type KeptImagePlan
} from '../../../export'
import type { ProjectEntry } from '../../../shared/contracts'
import { ExportPreview } from './ExportPreview'
import { uploadProjectPngs } from '../lib/projectImageUploads'
import { WorkspaceToolWindow } from './WorkspaceToolWindow'
import { KeptExportTemplateEditor } from './KeptExportTemplateEditor'
import {
  cloneKeptExportTemplateDraft,
  createDefaultKeptExportTemplateDraft,
  toKeptExportTemplate,
  type KeptExportTemplateDraft
} from './keptExportTemplateDraft'
import type { KeptExportTemplate } from '../../../shared/keptExportTemplate'

const PdfViewer = lazy(async () => {
  const module = await import('./PdfViewer')
  return { default: module.PdfViewer }
})

export type PdfExportFormat =
  'pdf' | 'pdf-layout' | 'pdf-compact' | 'pdf-kept' | 'pdf-kept-layout' | 'pdf-kept-canvas'

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
  onPlaceKeptImages?: (plan: KeptImagePlan) => void
  onOpenKeptCanvas?: () => void
  placedImageCount?: number
  onPreviewPlacedImages?: () => void
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
  onPlaceKeptImages,
  onOpenKeptCanvas,
  placedImageCount,
  onPreviewPlacedImages
}: ExportPanelProps): React.JSX.Element {
  const [previewFormat, setPreviewFormat] = useState<PdfExportFormat>('pdf')
  const [previewData, setPreviewData] = useState<Uint8Array | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [templateDraft, setTemplateDraft] = useState<KeptExportTemplateDraft>(() =>
    createDefaultKeptExportTemplateDraft()
  )
  const sessionImageSources = useMemo(
    () => buildSessionKeptImageSources(keptEntries),
    [keptEntries]
  )

  return (
    <aside className="export-panel" aria-label="Export reviewed project">
      <div className="export-actions">
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
                <option value="pdf-kept-canvas">Kept canvas layout</option>
              </select>
              <button
                className="secondary-button"
                type="button"
                disabled={isSaving || isPreviewing}
                onClick={async () => {
                  setIsPreviewing(true)
                  try {
                    setPreviewData(await onPreview(previewFormat))
                  } finally {
                    setIsPreviewing(false)
                  }
                }}
              >
                <Eye size={13} /> {isPreviewing ? 'Generating…' : 'Preview PDF'}
              </button>
            </div>
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
              onClick={() => setShowTemplateEditor(true)}
            >
              <FileOutput size={13} /> Configure kept export
            </button>
          )}
          {onOpenKeptCanvas && (
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving || keptEntries.length === 0}
              onClick={onOpenKeptCanvas}
            >
              <Images size={13} /> Open layout canvas
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
              <FileOutput size={13} /> Kept canvas layout
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
          title="Configure kept export"
          className="workspace-tool-window--kept-template"
          onClose={() => setShowTemplateEditor(false)}
        >
          <KeptExportTemplateEditor
            initialDraft={templateDraft}
            onCancel={() => setShowTemplateEditor(false)}
            onApply={(draft) => {
              setTemplateDraft(cloneKeptExportTemplateDraft(draft))
              setShowTemplateEditor(false)
            }}
            onExport={(draft) => {
              setTemplateDraft(cloneKeptExportTemplateDraft(draft))
              onTemplateExport(toKeptExportTemplate(draft))
              setShowTemplateEditor(false)
            }}
            onPreview={(draft) => {
              if (!onTemplatePreview) return
              void onTemplatePreview(toKeptExportTemplate(draft)).then(setPreviewData)
            }}
            isExporting={isSaving}
            sessionImageSources={sessionImageSources}
            onPlaceImages={onPlaceKeptImages}
            onUploadPngs={uploadProjectPngs}
            placedImageCount={placedImageCount}
            onPreviewPlacedImages={onPreviewPlacedImages}
          />
        </WorkspaceToolWindow>
      )}
    </aside>
  )
})
