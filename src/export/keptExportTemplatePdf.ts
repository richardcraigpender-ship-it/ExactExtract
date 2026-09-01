import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { ProjectState } from '../shared/contracts'
import { mapFinancialEntry, type FinancialColumnMapping } from '../analysis'
import { resolveCurrencyCode } from '../shared/currencies'
import { formatCurrencyAmount } from '../shared/currencyFormat'
import { extractEntryReferences } from '../review'
import {
  DEFAULT_KEPT_EXPORT_RUNNING_BALANCE,
  type KeptExportSourceRow,
  type KeptExportTemplate
} from '../shared/keptExportTemplate'
import { calculateStatementStats } from '../analysis'
import { buildKeptExportRenderPlan } from './keptExportLayout'
import { buildRunningBalanceValues, type RunningBalanceInputRow } from './runningBalance'

type SummaryField =
  | 'money-in-total'
  | 'money-out-total'
  | 'net-movement'
  | 'balance-snapshot-total'
  | 'opening-balance'
  | 'calculated-closing-balance'
  | 'statement-closing-balance'
  | 'reconciliation-difference'

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
  if (style.fontRef.family === 'Helvetica' && style.fontWeight === 'bold') {
    return StandardFonts.HelveticaBold
  }
  if (style.fontRef.family === 'Times-Roman' && style.fontStyle === 'italic') {
    return StandardFonts.TimesRomanItalic
  }
  return style.fontRef.family
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

function referenceForEntry(entry: ProjectState['entries'][number], rowReference?: string): string {
  const explicit = rowReference?.trim() || entry.notes?.trim()
  if (explicit) return explicit
  return extractEntryReferences(entry).join(', ')
}

function sourceRows(project: ProjectState, template?: KeptExportTemplate): KeptExportSourceRow[] {
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
        payee: entry.payee ?? row?.payee ?? row?.description ?? '',
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
  template: KeptExportTemplate
): Promise<Uint8Array> {
  const plan = buildKeptExportRenderPlan(sourceRows(project, template), template)
  if (plan.warnings.some((warning) => warning.code === 'no-columns')) {
    throw new Error('The export template needs at least one column.')
  }
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  for (const renderedPage of plan.pages) {
    const pageSize = dimensions(renderedPage.template)
    const page = pdf.addPage([pageSize.width, pageSize.height])
    const image =
      renderedPage.template.background && decodeImage(renderedPage.template.background.dataUrl)
    if (image) {
      const embedded =
        image.kind === 'png' ? await pdf.embedPng(image.bytes) : await pdf.embedJpg(image.bytes)
      page.drawImage(embedded, {
        x: renderedPage.template.background!.x,
        y:
          pageSize.height -
          renderedPage.template.background!.y -
          renderedPage.template.background!.height,
        width: renderedPage.template.background!.width,
        height: renderedPage.template.background!.height,
        opacity: Math.max(0, Math.min(1, renderedPage.template.background!.opacity))
      })
    }
    for (const placement of renderedPage.placements) {
      const font = await pdf.embedFont(fontName(placement.style))
      const y = pageSize.height - placement.y - placement.height + placement.style.fontSize
      page.drawText(safeText(placement.text, font), {
        x: placement.x,
        y,
        size: placement.style.fontSize,
        font,
        color: pdfColor(placement.style.color)
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
    const summaryFields = (template as KeptExportTemplate & { summaryFields?: SummaryField[] })
      .summaryFields
    if (renderedPage.pageNumber === plan.pages.length && summaryFields?.length) {
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
      const summaryFont = await pdf.embedFont(StandardFonts.Helvetica)
      summaryFields.forEach((field, index) => {
        const value = values[field]
        page.drawText(
          `${summaryLabel(field)}: ${value === null ? 'Unavailable' : value.toFixed(2)}`,
          {
            x: 48,
            y: 40 + (summaryFields.length - index - 1) * 14,
            size: 9,
            font: summaryFont,
            color: pdfColor('#17231c')
          }
        )
      })
    }
  }
  pdf.setTitle(`${project.name} - Kept Entries Template`)
  pdf.setProducer('EXACT EXTRACT')
  pdf.setCreator('EXACT EXTRACT')
  return pdf.save({ useObjectStreams: false })
}
