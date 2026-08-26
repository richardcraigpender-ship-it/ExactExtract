import React, { useState } from 'react'
import { Check, FileOutput, Plus, RotateCcw, Trash2 } from 'lucide-react'

import type { KeptEntriesFontRef } from '../../../shared/keptEntriesLayout'
import { getCanvasPageDimensions } from '../lib/canvasScale'
import { CanvasBackgroundControls } from './CanvasBackgroundControls'
import { FontPicker } from './FontPicker'
import {
  applyTextStyle,
  cloneKeptExportPageTemplate,
  cloneKeptExportTemplateDraft,
  createDefaultKeptExportPageTemplate,
  createDefaultKeptExportTemplateDraft,
  createKeptExportColumn,
  getDraftTemplate,
  setSeparateLaterPages,
  updateDraftTemplate,
  validateKeptExportTemplateDraft,
  type KeptExportColumnDraft,
  type KeptExportPageTemplateDraft,
  type KeptExportSourceField,
  type KeptExportSummaryField,
  type KeptExportTemplateDraft,
  type KeptExportTemplateTarget,
  type KeptExportTextStyle
} from './keptExportTemplateDraft'
import './KeptExportTemplateEditor.css'

interface KeptExportTemplateEditorProps {
  initialDraft?: KeptExportTemplateDraft
  onApply: (draft: KeptExportTemplateDraft) => void
  onExport: (draft: KeptExportTemplateDraft) => void
  onPreview?: (draft: KeptExportTemplateDraft) => void
  onCancel?: () => void
  isExporting?: boolean
}

const STANDARD_FONTS: Array<Extract<KeptEntriesFontRef, { kind: 'standard-14' }>['family']> = [
  'Helvetica',
  'Helvetica-Bold',
  'Times-Roman',
  'Courier'
]

const SOURCE_FIELDS: Array<{ value: KeptExportSourceField; label: string }> = [
  { value: 'text', label: 'Reviewed text' },
  { value: 'payee', label: 'Payee / description' },
  { value: 'date', label: 'Date' },
  { value: 'money-out', label: 'Money out' },
  { value: 'money-in', label: 'Money in' },
  { value: 'balance', label: 'Balance' },
  { value: 'category', label: 'Category' },
  { value: 'reference', label: 'Reference' }
]

const SUMMARY_FIELDS: Array<{ value: KeptExportSummaryField; label: string }> = [
  { value: 'money-in-total', label: 'Money in total' },
  { value: 'money-out-total', label: 'Money out total' },
  { value: 'net-movement', label: 'Net movement' },
  { value: 'balance-snapshot-total', label: 'Balance snapshot total' },
  { value: 'opening-balance', label: 'Opening balance' },
  { value: 'calculated-closing-balance', label: 'Calculated closing balance' },
  { value: 'statement-closing-balance', label: 'Statement closing balance' },
  { value: 'reconciliation-difference', label: 'Reconciliation difference' }
]

function numberValue(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function updateColumn(
  template: KeptExportPageTemplateDraft,
  columnId: string,
  patch: Partial<KeptExportColumnDraft>
): KeptExportPageTemplateDraft {
  return {
    ...template,
    columns: template.columns.map((column) =>
      column.id === columnId ? { ...column, ...patch } : column
    )
  }
}

export function KeptExportTemplateEditor({
  initialDraft,
  onApply,
  onExport,
  onPreview,
  onCancel,
  isExporting = false
}: KeptExportTemplateEditorProps): React.JSX.Element {
  const [draft, setDraft] = useState<KeptExportTemplateDraft>(() =>
    cloneKeptExportTemplateDraft(initialDraft ?? createDefaultKeptExportTemplateDraft())
  )
  const [target, setTarget] = useState<KeptExportTemplateTarget>('page-one')
  const [selectedColumnId, setSelectedColumnId] = useState(
    draft.pageOneTemplate.columns[0]?.id ?? ''
  )
  const [applyToAll, setApplyToAll] = useState(true)
  const activeTarget = draft.useSeparateLaterPages ? target : 'page-one'
  const template = getDraftTemplate(draft, activeTarget)
  const selectedColumn = template.columns.find((column) => column.id === selectedColumnId)
  const textStyle = selectedColumn?.textStyle ?? template.defaultTextStyle
  const dimensions = getCanvasPageDimensions(template.pageSize, template.orientation)
  const issues = validateKeptExportTemplateDraft(draft)

  const setTemplate = (
    update: (current: KeptExportPageTemplateDraft) => KeptExportPageTemplateDraft
  ): void => {
    setDraft((current) => updateDraftTemplate(current, activeTarget, update))
  }

  const setTextStyle = (patch: Partial<KeptExportTextStyle>): void => {
    const nextStyle: KeptExportTextStyle = {
      ...textStyle,
      ...patch,
      fontRef: patch.fontRef ? { ...patch.fontRef } : { ...textStyle.fontRef }
    }
    setTemplate((current) => applyTextStyle(current, nextStyle, applyToAll, selectedColumn?.id))
  }

  const resetActiveTemplate = (): void => {
    setTemplate(() =>
      activeTarget === 'later-pages'
        ? cloneKeptExportPageTemplate(draft.pageOneTemplate)
        : createDefaultKeptExportPageTemplate()
    )
    setSelectedColumnId('payee')
    setApplyToAll(true)
  }

  const resetAll = (): void => {
    const reset = createDefaultKeptExportTemplateDraft()
    setDraft(reset)
    setTarget('page-one')
    setSelectedColumnId(reset.pageOneTemplate.columns[0]?.id ?? '')
    setApplyToAll(true)
  }

  return (
    <section className="kept-template-editor" aria-labelledby="kept-template-editor-title">
      <header className="kept-template-editor-header">
        <div>
          <span className="eyebrow">KEPT EXPORT TEMPLATE</span>
          <strong id="kept-template-editor-title">Page template</strong>
        </div>
        <div className="kept-template-editor-header-actions">
          <button className="secondary-button" type="button" onClick={resetActiveTemplate}>
            <RotateCcw size={14} aria-hidden="true" /> Reset template
          </button>
          <button className="secondary-button" type="button" onClick={resetAll}>
            <RotateCcw size={14} aria-hidden="true" /> Reset all
          </button>
        </div>
      </header>

      <fieldset className="kept-template-choice">
        <legend>Page templates</legend>
        <label>
          <input
            type="radio"
            name="template-scope"
            checked={!draft.useSeparateLaterPages}
            onChange={() => {
              setDraft((current) => setSeparateLaterPages(current, false))
              setTarget('page-one')
            }}
          />
          Same template for every page
        </label>
        <label>
          <input
            type="radio"
            name="template-scope"
            checked={draft.useSeparateLaterPages}
            onChange={() => setDraft((current) => setSeparateLaterPages(current, true))}
          />
          Separate Page 1 and later pages
        </label>
      </fieldset>

      <div className="kept-template-tabs" role="tablist" aria-label="Template to edit">
        <button
          type="button"
          role="tab"
          aria-selected={activeTarget === 'page-one'}
          onClick={() => setTarget('page-one')}
        >
          Page 1
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTarget === 'later-pages'}
          disabled={!draft.useSeparateLaterPages}
          onClick={() => setTarget('later-pages')}
        >
          Later pages
        </button>
      </div>

      <div className="kept-template-scroll">
        <section className="kept-template-section" aria-labelledby="kept-template-layout-title">
          <h3 id="kept-template-layout-title">Layout</h3>
          <div className="kept-template-grid">
            <label>
              <span>Page size</span>
              <select
                value={template.pageSize}
                onChange={(event) =>
                  setTemplate((current) => ({
                    ...current,
                    pageSize: event.target.value as KeptExportPageTemplateDraft['pageSize']
                  }))
                }
              >
                <option value="letter">Letter</option>
                <option value="a4">A4</option>
              </select>
            </label>
            <label>
              <span>Orientation</span>
              <select
                value={template.orientation}
                onChange={(event) =>
                  setTemplate((current) => ({
                    ...current,
                    orientation: event.target.value as KeptExportPageTemplateDraft['orientation']
                  }))
                }
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
            <label>
              <span>Entries per page</span>
              <input
                type="number"
                min="1"
                max="500"
                step="1"
                value={template.entriesPerPage}
                onChange={(event) =>
                  setTemplate((current) => ({
                    ...current,
                    entriesPerPage: numberValue(event.target.value, 20)
                  }))
                }
              />
            </label>
          </div>
          <fieldset className="kept-template-choice">
            <legend>Layout mode</legend>
            <label>
              <input
                type="radio"
                name={`layout-mode-${activeTarget}`}
                checked={template.layoutMode === 'table-row'}
                onChange={() => setTemplate((current) => ({ ...current, layoutMode: 'table-row' }))}
              />
              Table / row
            </label>
            <label>
              <input
                type="radio"
                name={`layout-mode-${activeTarget}`}
                checked={template.layoutMode === 'column-fill'}
                onChange={() =>
                  setTemplate((current) => ({ ...current, layoutMode: 'column-fill' }))
                }
              />
              Column fill
            </label>
          </fieldset>
        </section>

        <section className="kept-template-section" aria-labelledby="kept-template-columns-title">
          <div className="kept-template-section-heading">
            <div>
              <h3 id="kept-template-columns-title">Columns</h3>
              <p>All measurements use PDF points and values are left-aligned.</p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                const id = crypto.randomUUID()
                setTemplate((current) => ({
                  ...current,
                  columns: [...current.columns, createKeptExportColumn(current.columns.length, id)]
                }))
                setSelectedColumnId(id)
              }}
            >
              <Plus size={14} aria-hidden="true" /> Add column
            </button>
          </div>
          <div className="kept-template-columns">
            {template.columns.map((column, index) => (
              <fieldset
                className={`kept-template-column ${
                  selectedColumnId === column.id ? 'is-selected' : ''
                }`}
                key={column.id}
              >
                <legend>
                  <label>
                    <input
                      type="radio"
                      name={`selected-column-${activeTarget}`}
                      checked={selectedColumnId === column.id}
                      onChange={() => setSelectedColumnId(column.id)}
                    />
                    Column {index + 1}
                  </label>
                </legend>
                <div className="kept-template-column-grid">
                  <label className="kept-template-column-name">
                    <span>Name</span>
                    <input
                      value={column.name}
                      onChange={(event) =>
                        setTemplate((current) =>
                          updateColumn(current, column.id, { name: event.target.value })
                        )
                      }
                    />
                  </label>
                  <label className="kept-template-column-source">
                    <span>Source field</span>
                    <select
                      value={column.sourceField}
                      onChange={(event) =>
                        setTemplate((current) =>
                          updateColumn(current, column.id, {
                            sourceField: event.target.value as KeptExportSourceField
                          })
                        )
                      }
                    >
                      {SOURCE_FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(['x', 'y', 'width', 'height', 'spacing'] as const).map((field) => (
                    <label key={field}>
                      <span>
                        {field === 'x' || field === 'y' ? field.toUpperCase() : field}
                        {field === 'height' && ' (whole column)'}
                        {field === 'spacing' && ' (between entries)'}
                      </span>
                      <input
                        type="number"
                        min={field === 'x' || field === 'y' ? 0 : 1}
                        step="1"
                        value={column[field]}
                        onChange={(event) =>
                          setTemplate((current) =>
                            updateColumn(current, column.id, {
                              [field]: numberValue(event.target.value, column[field])
                            })
                          )
                        }
                      />
                    </label>
                  ))}
                  <label>
                    <span>Overflow</span>
                    <select
                      value={column.overflow}
                      onChange={(event) =>
                        setTemplate((current) =>
                          updateColumn(current, column.id, {
                            overflow: event.target.value as KeptExportColumnDraft['overflow']
                          })
                        )
                      }
                    >
                      <option value="next-page">Next page</option>
                      <option value="wrap">Wrap</option>
                      <option value="clip">Clip</option>
                    </select>
                  </label>
                  <button
                    className="icon-button kept-template-remove-column"
                    type="button"
                    title={`Remove ${column.name || `column ${index + 1}`}`}
                    disabled={template.columns.length === 1}
                    onClick={() => {
                      const remaining = template.columns.filter(
                        (candidate) => candidate.id !== column.id
                      )
                      setTemplate((current) => ({ ...current, columns: remaining }))
                      if (selectedColumnId === column.id) {
                        setSelectedColumnId(remaining[0]?.id ?? '')
                      }
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </fieldset>
            ))}
          </div>
        </section>

        <section className="kept-template-section" aria-labelledby="kept-template-font-title">
          <div className="kept-template-section-heading">
            <div>
              <h3 id="kept-template-font-title">Text style</h3>
              <p>{applyToAll ? 'Applies to all columns.' : 'Applies to the selected column.'}</p>
            </div>
            <label className="kept-template-change-all">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(event) => setApplyToAll(event.target.checked)}
              />
              Change all entries
            </label>
          </div>
          <div className="kept-template-grid kept-template-font-grid">
            <label>
              <span>PDF font</span>
              <select
                value={textStyle.fontRef.kind === 'standard-14' ? textStyle.fontRef.family : ''}
                onChange={(event) => {
                  const family = event.target.value as Extract<
                    KeptEntriesFontRef,
                    { kind: 'standard-14' }
                  >['family']
                  if (family) setTextStyle({ fontRef: { kind: 'standard-14', family } })
                }}
              >
                {textStyle.fontRef.kind === 'system' && <option value="">System font</option>}
                {STANDARD_FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Size</span>
              <input
                type="number"
                min="6"
                max="96"
                value={textStyle.fontSize}
                onChange={(event) =>
                  setTextStyle({
                    fontSize: Math.max(6, Math.min(96, numberValue(event.target.value, 11)))
                  })
                }
              />
            </label>
            <label>
              <span>Color</span>
              <input
                type="color"
                value={textStyle.color}
                onChange={(event) => setTextStyle({ color: event.target.value })}
              />
            </label>
            <label>
              <span>Weight</span>
              <select
                value={textStyle.fontWeight}
                onChange={(event) =>
                  setTextStyle({
                    fontWeight: event.target.value as KeptExportTextStyle['fontWeight']
                  })
                }
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
              </select>
            </label>
            <label>
              <span>Style</span>
              <select
                value={textStyle.fontStyle}
                onChange={(event) =>
                  setTextStyle({
                    fontStyle: event.target.value as KeptExportTextStyle['fontStyle']
                  })
                }
              >
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </select>
            </label>
          </div>
          <FontPicker
            value={null}
            onChange={(selection) =>
              setTextStyle({
                fontRef: { kind: 'system', family: selection.family, style: selection.style }
              })
            }
          />
        </section>

        <CanvasBackgroundControls
          label={activeTarget === 'page-one' ? 'Page 1 background' : 'Later pages background'}
          background={template.background}
          defaultWidth={dimensions.width}
          defaultHeight={dimensions.height}
          onChange={(background) => setTemplate((current) => ({ ...current, background }))}
        />

        <section className="kept-template-section" aria-labelledby="kept-template-summary-title">
          <h3 id="kept-template-summary-title">Final-page financial summary</h3>
          <div className="kept-template-summary-grid">
            {SUMMARY_FIELDS.map((field) => (
              <label key={field.value}>
                <input
                  type="checkbox"
                  checked={draft.summaryFields.includes(field.value)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      summaryFields: event.target.checked
                        ? [...current.summaryFields, field.value]
                        : current.summaryFields.filter((value) => value !== field.value)
                    }))
                  }
                />
                {field.label}
              </label>
            ))}
          </div>
          <p className="context-help">
            Balance snapshot total is the sum of snapshots, not the account closing balance.
          </p>
        </section>
      </div>

      {issues.length > 0 && (
        <div className="kept-template-errors" role="alert">
          <strong>Fix the template before applying or exporting.</strong>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.path}:${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      <footer className="kept-template-editor-footer">
        {onCancel && (
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          className="secondary-button"
          type="button"
          disabled={issues.length > 0}
          onClick={() => onApply(cloneKeptExportTemplateDraft(draft))}
        >
          <Check size={15} aria-hidden="true" /> Apply
        </button>
        {onPreview && (
          <button
            className="secondary-button"
            type="button"
            disabled={issues.length > 0 || isExporting}
            onClick={() => onPreview(cloneKeptExportTemplateDraft(draft))}
          >
            Preview
          </button>
        )}
        <button
          className="primary-button"
          type="button"
          disabled={issues.length > 0 || isExporting}
          onClick={() => onExport(cloneKeptExportTemplateDraft(draft))}
        >
          <FileOutput size={15} aria-hidden="true" />
          {isExporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </footer>
    </section>
  )
}
