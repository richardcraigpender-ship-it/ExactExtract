import React, { useEffect, useState } from 'react'
import { Check, FileOutput, Plus, RotateCcw, Trash2 } from 'lucide-react'

import type { KeptEntriesFontRef } from '../../../shared/keptEntriesLayout'
import type {
  KeptExportDivider,
  KeptExportPageNumberAnchor,
  KeptExportRunningBalance
} from '../../../shared/keptExportTemplate'
import type { DetectedPageNumberMatch } from '../../../style'
import { pageNumberMatchToKeptExportPageNumbers } from '../../../style'
import { getCanvasPageDimensions } from '../lib/canvasScale'
import { CanvasBackgroundControls } from './CanvasBackgroundControls'
import { FontPicker } from './FontPicker'
import { LengthField } from './LengthField'
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
  onDraftChange?: (draft: KeptExportTemplateDraft) => void
  onApply: (draft: KeptExportTemplateDraft) => void
  onExport: (draft: KeptExportTemplateDraft) => void
  onPreview?: (draft: KeptExportTemplateDraft) => void
  onCancel?: () => void
  isExporting?: boolean
  isPreviewing?: boolean
  autoCloseAfterAction?: boolean
  onAutoCloseAfterActionChange?: (value: boolean) => void
  actionStatus?: string | null
  currencySymbol?: string
  onDetectPageNumbers?: () => Promise<DetectedPageNumberMatch | undefined>
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
  { value: 'calculated-balance', label: 'Calculated balance' },
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

const BALANCE_FIELD_MODES: Array<{
  value: KeptExportRunningBalance['balanceFieldMode']
  label: string
}> = [
  { value: 'keep-original', label: 'Keep original balance' },
  { value: 'replace-original', label: 'Replace Balance columns' },
  { value: 'add-calculated', label: 'Add calculated balance field' }
]

const PAGE_NUMBER_ANCHORS: Array<{ value: KeptExportPageNumberAnchor; label: string }> = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-right', label: 'Bottom right' }
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

function defaultDivider(pageWidth: number): KeptExportDivider {
  const startX = 48
  return {
    enabled: false,
    startX,
    endX: pageWidth - 48,
    width: pageWidth - startX - 48,
    thickness: 1,
    color: '#17231c',
    opacity: 0.35
  }
}

export function KeptExportTemplateEditor({
  initialDraft,
  onDraftChange,
  onApply,
  onExport,
  onPreview,
  onCancel,
  isExporting = false,
  isPreviewing = false,
  autoCloseAfterAction = false,
  onAutoCloseAfterActionChange,
  actionStatus,
  currencySymbol = '£',
  onDetectPageNumbers
}: KeptExportTemplateEditorProps): React.JSX.Element {
  const [draft, setDraft] = useState<KeptExportTemplateDraft>(() =>
    cloneKeptExportTemplateDraft(initialDraft ?? createDefaultKeptExportTemplateDraft())
  )
  const [target, setTarget] = useState<KeptExportTemplateTarget>('page-one')
  const [selectedColumnId, setSelectedColumnId] = useState(
    draft.pageOneTemplate.columns[0]?.id ?? ''
  )
  const [applyToAll, setApplyToAll] = useState(true)
  const [isDetectingPageNumbers, setIsDetectingPageNumbers] = useState(false)
  const [pageNumberDetectionStatus, setPageNumberDetectionStatus] = useState<string | null>(null)
  const activeTarget = draft.useSeparateLaterPages ? target : 'page-one'
  const template = getDraftTemplate(draft, activeTarget)
  const selectedColumn = template.columns.find((column) => column.id === selectedColumnId)
  const textStyle = selectedColumn?.textStyle ?? template.defaultTextStyle
  const dimensions = getCanvasPageDimensions(template.pageSize, template.orientation)
  const divider = template.divider ?? defaultDivider(dimensions.width)
  const runningBalance = draft.runningBalance
  const pageNumbers = draft.pageNumbers
  const issues = validateKeptExportTemplateDraft(draft)

  useEffect(() => {
    onDraftChange?.(cloneKeptExportTemplateDraft(draft))
  }, [draft, onDraftChange])

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

  const setDivider = (update: (current: KeptExportDivider) => KeptExportDivider): void => {
    setTemplate((current) => ({
      ...current,
      divider: update(current.divider ?? defaultDivider(dimensions.width))
    }))
  }

  const setRunningBalance = (
    update: (current: KeptExportRunningBalance) => KeptExportRunningBalance
  ): void => {
    setDraft((current) => ({ ...current, runningBalance: update(current.runningBalance) }))
  }

  const setPageNumbers = (
    update: (current: typeof pageNumbers) => typeof pageNumbers,
    matchesSource = false
  ): void => {
    setDraft((current) => ({
      ...current,
      pageNumbers: { ...update(current.pageNumbers), matchSourceStyle: matchesSource }
    }))
  }

  const detectPageNumbers = async (): Promise<void> => {
    if (!onDetectPageNumbers) return
    setIsDetectingPageNumbers(true)
    setPageNumberDetectionStatus('Scanning the source PDF for existing page numbers...')
    try {
      const match = await onDetectPageNumbers()
      if (!match) {
        setPageNumberDetectionStatus(
          'No consistent page numbers were found in the source document. Turn page numbers on and set the position manually if you still want them.'
        )
        return
      }
      setDraft((current) => ({
        ...current,
        pageNumbers: pageNumberMatchToKeptExportPageNumbers(match)
      }))
      setPageNumberDetectionStatus(
        `Matched the source page numbers from ${match.matchedPageCount} of ${match.totalPageCount} pages.`
      )
    } finally {
      setIsDetectingPageNumbers(false)
    }
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
              <span>Maximum entries per page</span>
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
            <legend>Vertical flow</legend>
            <label>
              <input
                type="checkbox"
                checked={template.fillBetweenY ?? false}
                onChange={(event) =>
                  setTemplate((current) => ({ ...current, fillBetweenY: event.target.checked }))
                }
              />
              Fill between Start Y and End Y
            </label>
            <label>
              <input
                type="checkbox"
                checked={template.showReferenceUnderMainText ?? false}
                onChange={(event) =>
                  setTemplate((current) => ({
                    ...current,
                    showReferenceUnderMainText: event.target.checked
                  }))
                }
              />
              Show references under main text
            </label>
            <LengthField
              label="Start Y"
              min={0}
              value={template.startY ?? template.columns[0]?.y ?? 0}
              disabled={!template.fillBetweenY}
              onChange={(points) => setTemplate((current) => ({ ...current, startY: points }))}
            />
            <LengthField
              label="End Y"
              min={0}
              value={template.endY ?? dimensions.height}
              disabled={!template.fillBetweenY}
              onChange={(points) => setTemplate((current) => ({ ...current, endY: points }))}
            />
          </fieldset>
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

        <section className="kept-template-section" aria-labelledby="kept-template-divider-title">
          <div className="kept-template-section-heading">
            <div>
              <h3 id="kept-template-divider-title">Entry divider</h3>
              <p>Draw a horizontal divider after every exported entry.</p>
            </div>
            <label className="kept-template-change-all">
              <input
                type="checkbox"
                checked={divider.enabled}
                onChange={(event) =>
                  setDivider((current) => ({ ...current, enabled: event.target.checked }))
                }
              />
              Show dividers
            </label>
          </div>
          <div className="kept-template-grid kept-template-divider-grid">
            <LengthField
              label="Width"
              min={1}
              value={divider.width}
              disabled={!divider.enabled}
              onChange={(width) =>
                setDivider((current) => ({ ...current, width, endX: current.startX + width }))
              }
            />
            <LengthField
              label="Thickness"
              min={0.1}
              value={divider.thickness}
              disabled={!divider.enabled}
              onChange={(thickness) => setDivider((current) => ({ ...current, thickness }))}
            />
            <label>
              <span>Color</span>
              <input
                type="color"
                value={divider.color}
                disabled={!divider.enabled}
                onChange={(event) =>
                  setDivider((current) => ({ ...current, color: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Opacity</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={divider.opacity}
                disabled={!divider.enabled}
                onChange={(event) =>
                  setDivider((current) => ({
                    ...current,
                    opacity: Math.max(
                      0,
                      Math.min(1, numberValue(event.target.value, current.opacity))
                    )
                  }))
                }
              />
            </label>
            <LengthField
              label="Start X"
              min={0}
              value={divider.startX}
              disabled={!divider.enabled}
              onChange={(startX) =>
                setDivider((current) => ({ ...current, startX, endX: startX + current.width }))
              }
            />
            <LengthField
              label="End X"
              min={0}
              value={divider.endX}
              disabled={!divider.enabled}
              onChange={(endX) =>
                setDivider((current) => ({ ...current, endX, width: endX - current.startX }))
              }
            />
          </div>
        </section>

        <section className="kept-template-section" aria-labelledby="kept-template-balance-title">
          <div className="kept-template-section-heading">
            <div>
              <h3 id="kept-template-balance-title">Calculated balance</h3>
              <p>
                Runs through kept entries in export order, adding money in and taking money out.
              </p>
            </div>
            <label className="kept-template-change-all">
              <input
                type="checkbox"
                checked={runningBalance.enabled}
                onChange={(event) =>
                  setRunningBalance((current) => ({ ...current, enabled: event.target.checked }))
                }
              />
              Add calculated running balance
            </label>
          </div>
          <div className="kept-template-grid kept-template-balance-grid">
            <label>
              <span>Opening balance ({currencySymbol})</span>
              <input
                type="number"
                step="0.01"
                placeholder="Blank"
                value={runningBalance.openingBalance ?? ''}
                disabled={!runningBalance.enabled}
                onChange={(event) =>
                  setRunningBalance((current) => ({
                    ...current,
                    openingBalance:
                      event.target.value.trim() === '' ? undefined : Number(event.target.value)
                  }))
                }
              />
            </label>
            <label>
              <span>If blank</span>
              <select
                value={runningBalance.fallback}
                disabled={!runningBalance.enabled}
                onChange={(event) =>
                  setRunningBalance((current) => ({
                    ...current,
                    fallback: event.target.value as KeptExportRunningBalance['fallback']
                  }))
                }
              >
                <option value="first-existing-balance">Use first detected balance</option>
                <option value="zero">Start from zero</option>
              </select>
            </label>
            <label>
              <span>Decimal places</span>
              <input
                type="number"
                min="0"
                max="6"
                step="1"
                value={runningBalance.decimalPlaces}
                disabled={!runningBalance.enabled}
                onChange={(event) =>
                  setRunningBalance((current) => ({
                    ...current,
                    decimalPlaces: numberValue(event.target.value, current.decimalPlaces)
                  }))
                }
              />
            </label>
          </div>
          <fieldset className="kept-template-choice">
            <legend>Original balance output</legend>
            {BALANCE_FIELD_MODES.map((mode) => (
              <label key={mode.value}>
                <input
                  type="radio"
                  name={`balance-field-mode-${activeTarget}`}
                  checked={runningBalance.balanceFieldMode === mode.value}
                  disabled={!runningBalance.enabled}
                  onChange={() =>
                    setRunningBalance((current) => ({ ...current, balanceFieldMode: mode.value }))
                  }
                />
                {mode.label}
              </label>
            ))}
          </fieldset>
          <p className="context-help">
            Leave the opening balance blank to infer it from the first detected balance, otherwise
            the run starts from zero. Replacing sends calculated values to existing Balance columns.
          </p>
        </section>

        <section
          className="kept-template-section"
          aria-labelledby="kept-template-page-numbers-title"
        >
          <div className="kept-template-section-heading">
            <div>
              <h3 id="kept-template-page-numbers-title">Page numbers</h3>
              <p>
                Matches the source document&rsquo;s existing page numbers by default. Position,
                format, and style can be changed at any time.
              </p>
            </div>
            <label className="kept-template-change-all">
              <input
                type="checkbox"
                checked={pageNumbers.enabled}
                onChange={(event) =>
                  setPageNumbers(
                    (current) => ({ ...current, enabled: event.target.checked }),
                    pageNumbers.matchSourceStyle && event.target.checked
                  )
                }
              />
              Add page numbers
            </label>
          </div>
          {onDetectPageNumbers && (
            <div className="kept-template-page-numbers-detect">
              <button
                className="secondary-button"
                type="button"
                disabled={isDetectingPageNumbers}
                onClick={() => void detectPageNumbers()}
              >
                {isDetectingPageNumbers ? 'Scanning source...' : 'Match source page numbers'}
              </button>
              {pageNumberDetectionStatus && (
                <span role="status" aria-live="polite">
                  {pageNumberDetectionStatus}
                </span>
              )}
              {pageNumbers.enabled &&
                pageNumbers.matchSourceStyle &&
                !pageNumberDetectionStatus && (
                  <span role="status">Matched from the source document.</span>
                )}
            </div>
          )}
          <div className="kept-template-grid kept-template-page-numbers-grid">
            <label>
              <span>Position</span>
              <select
                value={pageNumbers.anchor}
                disabled={!pageNumbers.enabled}
                onChange={(event) =>
                  setPageNumbers((current) => ({
                    ...current,
                    anchor: event.target.value as KeptExportPageNumberAnchor
                  }))
                }
              >
                {PAGE_NUMBER_ANCHORS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <LengthField
              label="Horizontal offset"
              value={pageNumbers.offsetX}
              disabled={!pageNumbers.enabled}
              onChange={(offsetX) => setPageNumbers((current) => ({ ...current, offsetX }))}
            />
            <LengthField
              label="Vertical offset"
              min={0}
              value={pageNumbers.offsetY}
              disabled={!pageNumbers.enabled}
              onChange={(offsetY) => setPageNumbers((current) => ({ ...current, offsetY }))}
            />
            <label>
              <span>Format</span>
              <input
                type="text"
                value={pageNumbers.format.template}
                disabled={!pageNumbers.enabled}
                placeholder="{n}"
                onChange={(event) =>
                  setPageNumbers((current) => ({
                    ...current,
                    format: { ...current.format, template: event.target.value }
                  }))
                }
              />
            </label>
            <label>
              <span>Start at</span>
              <input
                type="number"
                step="1"
                value={pageNumbers.format.startAt}
                disabled={!pageNumbers.enabled}
                onChange={(event) =>
                  setPageNumbers((current) => ({
                    ...current,
                    format: {
                      ...current.format,
                      startAt: Math.trunc(numberValue(event.target.value, current.format.startAt))
                    }
                  }))
                }
              />
            </label>
            <label>
              <span>Scale</span>
              <input
                type="number"
                min="0.1"
                max="5"
                step="0.1"
                value={pageNumbers.scale}
                disabled={!pageNumbers.enabled}
                onChange={(event) =>
                  setPageNumbers((current) => ({
                    ...current,
                    scale: Math.max(0.1, numberValue(event.target.value, current.scale))
                  }))
                }
              />
            </label>
            <label>
              <span>Size</span>
              <input
                type="number"
                min="6"
                max="72"
                value={pageNumbers.textStyle.fontSize}
                disabled={!pageNumbers.enabled}
                onChange={(event) =>
                  setPageNumbers((current) => ({
                    ...current,
                    textStyle: {
                      ...current.textStyle,
                      fontSize: Math.max(6, Math.min(72, numberValue(event.target.value, 9)))
                    }
                  }))
                }
              />
            </label>
            <label>
              <span>Color</span>
              <input
                type="color"
                value={pageNumbers.textStyle.color}
                disabled={!pageNumbers.enabled}
                onChange={(event) =>
                  setPageNumbers((current) => ({
                    ...current,
                    textStyle: { ...current.textStyle, color: event.target.value }
                  }))
                }
              />
            </label>
            <label>
              <span>PDF font</span>
              <select
                value={
                  pageNumbers.textStyle.fontRef.kind === 'standard-14'
                    ? pageNumbers.textStyle.fontRef.family
                    : ''
                }
                disabled={!pageNumbers.enabled}
                onChange={(event) => {
                  const family = event.target.value as Extract<
                    KeptEntriesFontRef,
                    { kind: 'standard-14' }
                  >['family']
                  if (!family) return
                  setPageNumbers((current) => ({
                    ...current,
                    textStyle: { ...current.textStyle, fontRef: { kind: 'standard-14', family } }
                  }))
                }}
              >
                {pageNumbers.textStyle.fontRef.kind === 'system' && (
                  <option value="">System font</option>
                )}
                {STANDARD_FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
                    <LengthField
                      key={field}
                      label={`${field === 'x' || field === 'y' ? field.toUpperCase() : field}${
                        field === 'height'
                          ? ' (whole column)'
                          : field === 'spacing'
                            ? ' (between entries)'
                            : ''
                      }`}
                      min={field === 'x' || field === 'y' ? 0 : 1}
                      value={column[field]}
                      onChange={(points) =>
                        setTemplate((current) =>
                          updateColumn(current, column.id, { [field]: points })
                        )
                      }
                    />
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
        <div className="kept-template-editor-footer-meta">
          <label className="kept-template-auto-close">
            <input
              type="checkbox"
              checked={autoCloseAfterAction}
              onChange={(event) => onAutoCloseAfterActionChange?.(event.target.checked)}
            />
            Auto-close after actions
          </label>
          {actionStatus && (
            <span className="kept-template-action-status" role="status" aria-live="polite">
              {actionStatus}
            </span>
          )}
        </div>
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
            disabled={issues.length > 0 || isExporting || isPreviewing}
            onClick={() => onPreview(cloneKeptExportTemplateDraft(draft))}
          >
            {isPreviewing ? 'Generating preview...' : 'Preview'}
          </button>
        )}
        <button
          className="primary-button"
          type="button"
          disabled={issues.length > 0 || isExporting || isPreviewing}
          onClick={() => onExport(cloneKeptExportTemplateDraft(draft))}
        >
          <FileOutput size={15} aria-hidden="true" />
          {isExporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </footer>
    </section>
  )
}
