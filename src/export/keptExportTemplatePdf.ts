import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { ProjectState } from '../shared/contracts'
import { mapFinancialEntry, type FinancialColumnMapping } from '../analysis'
import { resolveCurrencyCode } from '../shared/currencies'
import { formatCurrencyAmount } from '../shared/currencyFormat'
import {
  DEFAULT_KEPT_EXPORT_RUNNING_BALANCE,
  type KeptExportSourceRow,
  type KeptExportTemplate
} from '../shared/keptExportTemplate'
import { calculateStatementStats } from '../analysis'
import { buildKeptExportRenderPlan } from './keptExportLayout'
import { buildRunningBalanceValues, type RunningBalanceInputRow } from './runningBalance'
import { buildPageNumberDraw } from './pageNumbers'
import { applySourceMetadata, loadSourceMetadata } from './sourceMetadata'

type SummaryField =
  | 'money-in-total'
  | 'money-out-total'
  | 'net-movement'
  | 'balance-snapshot-total'
  | 'opening-balance'
  | 'calculated-closing-balance'
  | 'statement-closing-balance'
  | 'reconciliation-difference'

/** Shared with the canvas preview so the summary block is positioned identically. */
export const KEPT_EXPORT_SUMMARY_GEOMETRY = {
  x: 48,
  baseY: 40,
  lineHeight: 14,
  fontSize: 9,
  color: '#17231c'
} as const

const PAGE_DIMENSIONS = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 }
} as const

function dimensions(template: KeptExportTemplate['pageOneTemplate']): {
  width: number
  height: number
} {
  const page = PAGE_DIMENSIONS[template.pageSize]
  return template.orientation === 'portrait' ? page : { width: page.height, height: page.width }
}

function pdfColor(value: string): ReturnType<typeof rgb> {
  const match = /^#([\da-f]{6})$/i.exec(value.trim())
  if (!match) return rgb(0.09, 0.14, 0.11)
  return rgb(
    Number.parseInt(match[1].slice(0, 2), 16) / 255,
    Number.parseInt(match[1].slice(2, 4), 16) / 255,
    Number.parseInt(match[1].slice(4, 6), 16) / 255
  )
}

function decodeImage(dataUrl: string): { kind: 'png' | 'jpg'; bytes: Uint8Array } | undefined {
  const match = /^data:(image\/png|image\/(?:jpeg|jpg));base64,(.+)$/i.exec(dataUrl)
  if (!match) return undefined
  const binary = atob(match[2])
  return {
    kind: match[1].toLowerCase() === 'image/png' ? 'png' : 'jpg',
    bytes: Uint8Array.from(binary, (character) => character.charCodeAt(0))
  }
}

function safeText(value: string, font: PDFFont): string {
  return [...value]
    .map((character) => {
      try {
        font.encodeText(character)
        return character
      } catch {
        return '?'
      }
    })
    .join('')
}

function fontName(style: {
  fontRef: { kind: string; family: string }
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
}): string {
  if (style.fontRef.kind !== 'standard-14') return StandardFonts.Helvetica
  if (style.fontRef.family === 'Helvetica') {
    if (style.fontWeight === 'bold' && style.fontStyle === 'italic')
      return StandardFonts.HelveticaBoldOblique
    if (style.fontWeight === 'bold') return StandardFonts.HelveticaBold
    if (style.fontStyle === 'italic') return StandardFonts.HelveticaOblique
    return StandardFonts.Helvetica
  }
  if (style.fontRef.family === 'Times-Roman') {
    if (style.fontWeight === 'bold' && style.fontStyle === 'italic')
      return StandardFonts.TimesRomanBoldItalic
    if (style.fontWeight === 'bold') return StandardFonts.TimesRomanBold
    if (style.fontStyle === 'italic') return StandardFonts.TimesRomanItalic
    return StandardFonts.TimesRoman
  }
  if (style.fontRef.family === 'Courier') {
    if (style.fontWeight === 'bold' && style.fontStyle === 'italic')
      return StandardFonts.CourierBoldOblique
    if (style.fontWeight === 'bold') return StandardFonts.CourierBold
    if (style.fontStyle === 'italic') return StandardFonts.CourierOblique
    return StandardFonts.Courier
  }
  return StandardFonts.Helvetica
}

function summaryLabel(field: SummaryField): string {
  return {
    'money-in-total': 'Money in total',
    'money-out-total': 'Money out total',
    'net-movement': 'Net movement',
    'balance-snapshot-total': 'Balance snapshot total',
    'opening-balance': 'Opening balance',
    'calculated-closing-balance': 'Calculated closing balance',
    'statement-closing-balance': 'Statement closing balance',
    'reconciliation-difference': 'Reconciliation difference'
  }[field]
}

function mappingForStats(): FinancialColumnMapping {
  return {
    amountColumns: ['money-out', 'money-in', 'balance'],
    dateSource: 'detected-date',
    descriptionSource: 'detected-description',
    referenceSource: 'entry-notes',
    categorySource: 'entry-category'
  }
}

export interface KeptExportSummaryLine {
  field: SummaryField
  text: string
}

/**
 * Shared by the PDF renderer and the canvas preview so the statement summary text drawn on the
 * final page is always identical, not independently computed in two places.
 */
export function buildKeptExportSummaryLines(
  project: ProjectState,
  template: KeptExportTemplate
): KeptExportSummaryLine[] {
  const summaryFields = (template as KeptExportTemplate & { summaryFields?: SummaryField[] })
    .summaryFields
  if (!summaryFields?.length) return []
  const stats = calculateStatementStats(project.entries, mappingForStats(), 'kept')
  const values: Record<SummaryField, number | null> = {
    'money-in-total': stats.moneyIn,
    'money-out-total': stats.moneyOut,
    'net-movement': stats.netMovement,
    'balance-snapshot-total': stats.balanceTotal,
    'opening-balance': stats.openingBalance,
    'calculated-closing-balance': stats.calculatedClosingBalance,
    'statement-closing-balance': stats.closingBalance,
    'reconciliation-difference': stats.difference
  }
  return summaryFields.map((field) => {
    const value = values[field]
    return {
      field,
      text: `${summaryLabel(field)}: ${value === null ? 'Unavailable' : value.toFixed(2)}`
    }
  })
}

/** Only captured or user-entered text is exported; a row with no reference stays blank. */
function referenceForEntry(entry: ProjectState['entries'][number], rowReference?: string): string {
  return rowReference?.trim() || entry.reference?.trim() || entry.notes?.trim() || ''
}

export function buildKeptExportSourceRows(
  project: ProjectState,
  template?: KeptExportTemplate
): KeptExportSourceRow[] {
  const mapping = mappingForStats()
  const currencyCode = resolveCurrencyCode(project.settings.currencyCode)
  const kept = project.entries.filter((entry) => entry.status === 'keep')
  const mapped = kept.map((entry) => ({ entry, row: mapFinancialEntry(entry, mapping) }))

  const runningBalance = template?.runningBalance ?? DEFAULT_KEPT_EXPORT_RUNNING_BALANCE
  let calculated: Map<string, number> | undefined
  let decimalPlaces = DEFAULT_KEPT_EXPORT_RUNNING_BALANCE.decimalPlaces
  if (runningBalance.enabled) {
    decimalPlaces = Math.max(0, Math.min(6, Math.trunc(runningBalance.decimalPlaces)))
    const inputRows: RunningBalanceInputRow[] = mapped.map(({ entry, row }) => ({
      entryId: entry.id,
      moneyIn: row?.moneyIn,
      moneyOut: row?.moneyOut,
      balance: row?.balance,
      financiallyMapped: row !== null
    }))
    calculated = buildRunningBalanceValues(inputRows, runningBalance).values
  }

  return mapped.map(({ entry, row }) => {
    // Non-financial entries still export; only the money/date columns stay blank.
    const originalBalance =
      row?.balance === undefined ? '' : formatCurrencyAmount(row.balance, currencyCode)
    const calculatedValue = calculated?.get(entry.id)
    const calculatedBalance =
      calculatedValue === undefined
        ? ''
        : formatCurrencyAmount(calculatedValue, currencyCode, { decimalPlaces })
    return {
      entryId: entry.id,
      values: {
        text: entry.normalizedText,
        payee: row?.payee ?? entry.payee ?? row?.description ?? '',
        date: row?.date ?? entry.date ?? '',
        'money-out': row?.moneyOut ? formatCurrencyAmount(row.moneyOut, currencyCode) : '',
        'money-in': row?.moneyIn ? formatCurrencyAmount(row.moneyIn, currencyCode) : '',
        balance:
          runningBalance.enabled && runningBalance.balanceFieldMode === 'replace-original'
            ? calculatedBalance
            : originalBalance,
        'calculated-balance': calculatedBalance,
        category: row?.category ?? entry.category ?? '',
        reference: referenceForEntry(entry, row?.reference)
      }
    }
  })
}

export async function exportProjectKeptEntriesTemplatePdf(
  project: ProjectState,
  template: KeptExportTemplate,
  sourceFiles?: ReadonlyMap<string, Uint8Array>,
  /** Bytes for managed background refs; inline legacy backgrounds do not need this. */
  backgroundDataUrls?: ReadonlyMap<string, string>
): Promise<Uint8Array> {
  const plan = buildKeptExportRenderPlan(buildKeptExportSourceRows(project, template), template)
  if (plan.warnings.some((warning) => warning.code === 'no-columns')) {
    throw new Error('The export template needs at least one column.')
  }
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const pageNumbers = template.pageNumbers
  const pageNumberFont = pageNumbers?.enabled
    ? await pdf.embedFont(fontName(pageNumbers.textStyle))
    : undefined
  for (const renderedPage of plan.pages) {
    const pageSize = dimensions(renderedPage.template)
    const page = pdf.addPage([pageSize.width, pageSize.height])
    const background = renderedPage.template.background
    const backgroundSource = background?.ref ? backgroundDataUrls?.get(background.ref) : undefined
    const image = backgroundSource ? decodeImage(backgroundSource) : undefined
    if (image && background) {
      const embedded =
        image.kind === 'png' ? await pdf.embedPng(image.bytes) : await pdf.embedJpg(image.bytes)
      page.drawImage(embedded, {
        x: background.x,
        y: pageSize.height - background.y - background.height,
        width: background.width,
        height: background.height,
        opacity: Math.max(0, Math.min(1, background.opacity))
      })
    }
    for (const placement of renderedPage.placements) {
      const font = await pdf.embedFont(fontName(placement.style))
      const lineHeight = placement.style.fontSize * 1.2
      const baseY = pageSize.height - placement.y - placement.style.fontSize
      placement.lines.forEach((line, lineIndex) => {
        const text = safeText(line, font)
        const textWidth = font.widthOfTextAtSize(text, placement.style.fontSize)
        const freeSpace = Math.max(0, placement.width - textWidth)
        const x =
          placement.align === 'right'
            ? placement.x + freeSpace
            : placement.align === 'center'
              ? placement.x + freeSpace / 2
              : placement.x
        page.drawText(text, {
          x,
          y: baseY - lineIndex * lineHeight,
          size: placement.style.fontSize,
          font,
          color: pdfColor(placement.style.color)
        })
      })
    }
    for (const divider of renderedPage.dividers) {
      page.drawLine({
        start: { x: divider.startX, y: pageSize.height - divider.y },
        end: { x: divider.endX, y: pageSize.height - divider.y },
        thickness: divider.thickness,
        color: pdfColor(divider.color),
        opacity: divider.opacity
      })
    }
    if (pageNumbers?.enabled && pageNumberFont) {
      const draw = buildPageNumberDraw(
        pageNumbers,
        renderedPage.pageNumber,
        plan.pages.length,
        pageSize.width,
        pageSize.height,
        (text, fontSize) => pageNumberFont.widthOfTextAtSize(text, fontSize)
      )
      if (draw) {
        page.drawText(safeText(draw.text, pageNumberFont), {
          x: draw.x,
          y: draw.y,
          size: draw.fontSize,
          font: pageNumberFont,
          color: pdfColor(pageNumbers.textStyle.color)
        })
      }
    }
    const summaryLines =
      renderedPage.pageNumber === plan.pages.length
        ? buildKeptExportSummaryLines(project, template)
        : []
    if (summaryLines.length > 0) {
      const summaryFont = await pdf.embedFont(StandardFonts.Helvetica)
      summaryLines.forEach((line, index) => {
        page.drawText(safeText(line.text, summaryFont), {
          x: KEPT_EXPORT_SUMMARY_GEOMETRY.x,
          y:
            KEPT_EXPORT_SUMMARY_GEOMETRY.baseY +
            (summaryLines.length - index - 1) * KEPT_EXPORT_SUMMARY_GEOMETRY.lineHeight,
          size: KEPT_EXPORT_SUMMARY_GEOMETRY.fontSize,
          font: summaryFont,
          color: pdfColor(KEPT_EXPORT_SUMMARY_GEOMETRY.color)
        })
      })
    }
  }
  pdf.setTitle(`${project.name} - Kept Entries Template`)
  pdf.setProducer('EXACT EXTRACT')
  pdf.setCreator('EXACT EXTRACT')
  if (sourceFiles)
    applySourceMetadata(pdf, await loadSourceMetadata(project.documents, sourceFiles))
  return pdf.save({ useObjectStreams: false })
}
