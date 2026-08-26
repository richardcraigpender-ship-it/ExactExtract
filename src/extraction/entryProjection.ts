import type { ProjectEntry } from '../shared/contracts'
import { extractAccountingLineDetails } from './accounting'
import { classifySemanticLines } from './semantics'
import { adaptRevolutTransaction, isRevolutStatement } from './revolutAdapter'
import type { ParserExtractionResult } from './types'

function parseTotalValue(text: string): number | undefined {
  const normalized = text.replace(/\s/g, '').replace(/,/g, '')
  const match = normalized.match(/\(?-?\d+(?:\.\d+)?\)?/)
  if (!match) return undefined
  const value = Number(match[0].replace(/[()]/g, ''))
  if (!Number.isFinite(value)) return undefined
  return normalized.startsWith('(') || normalized.startsWith('-') ? -Math.abs(value) : value
}

const DATE_PREFIX =
  /^(?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+/i
const FIRST_AMOUNT = /(?:[$€£¥₹]\s*)?\(?[+-]?\d/
const PERSONAL_HONORIFIC = /^(?:mr|mrs|ms|miss|dr|prof)\.?\s+/i

export function extractFinancialPayee(
  text: string,
  accountingDocument: boolean
): string | undefined {
  if (!accountingDocument) return undefined
  const withoutDate = text.replace(DATE_PREFIX, '')
  const firstAmountIndex = withoutDate.search(FIRST_AMOUNT)
  if (firstAmountIndex <= 0) return undefined
  const payee = withoutDate.slice(0, firstAmountIndex).replace(/\s+/g, ' ').trim()
  if (!payee || PERSONAL_HONORIFIC.test(payee)) return undefined
  return payee
}

export function projectParserEntries(
  result: ParserExtractionResult,
  timestamp: string = new Date().toISOString()
): ProjectEntry[] {
  if (Number.isNaN(Date.parse(timestamp))) throw new Error('timestamp must be an ISO date.')

  const blocksById = new Map(result.blocks.map((block) => [block.id, block]))
  const semanticsByLineId = new Map(
    classifySemanticLines(result.lines).map((candidate) => [candidate.lineId, candidate])
  )
  const accountingDocument =
    result.classification.kind === 'financial' ||
    result.classification.kind === 'invoice' ||
    result.classification.evidence.some((item) => item.startsWith('financial:'))
  const revolutStatement = isRevolutStatement(result.lines.map((line) => line.text))
  const runningTotals = new Map<string, number>()
  const transactionLines = result.lines.filter((line) => {
    if (!DATE_PREFIX.test(line.text)) return false
    DATE_PREFIX.lastIndex = 0
    const withoutDate = line.text.replace(DATE_PREFIX, '')
    return withoutDate.search(FIRST_AMOUNT) > 0
  })
  DATE_PREFIX.lastIndex = 0
  const lines =
    result.classification.kind === 'tabular' && transactionLines.length >= 2
      ? transactionLines
      : result.lines
  let previousRevolutBalance: number | undefined
  return lines.map((line) => {
    const blocks = line.blockIds
      .map((blockId) => blocksById.get(blockId))
      .filter((block): block is NonNullable<typeof block> => block !== undefined)
    const confidence =
      blocks.length === 0
        ? 0
        : blocks.reduce((total, block) => total + block.confidence, 0) / blocks.length
    const table = result.tables.find((candidate) => candidate.rowLineIds.includes(line.id))
    const semantic = semanticsByLineId.get(line.id)
    const adaptedText = revolutStatement
      ? adaptRevolutTransaction(line.text, previousRevolutBalance)
      : undefined
    const financialText = adaptedText ?? line.text
    if (revolutStatement && adaptedText) {
      const balanceMatch = [...financialText.matchAll(/£\s*([\d,]+\.\d{2})/g)].at(-1)
      previousRevolutBalance = balanceMatch ? Number(balanceMatch[1]!.replace(',', '')) : undefined
    }
    const accounting = extractAccountingLineDetails(
      financialText,
      accountingDocument || revolutStatement
    )
    const totalColumn = table?.totalColumn
    const totalBlockText = totalColumn
      ? blocks
          .filter(
            (block) =>
              block.bbox.x + block.bbox.width >= totalColumn.xStart &&
              block.bbox.x <= totalColumn.xEnd
          )
          .map((block) => block.text)
          .join(' ')
      : ''
    const parsedTotal = totalColumn ? parseTotalValue(totalBlockText) : undefined
    const payee = extractFinancialPayee(financialText, accountingDocument || revolutStatement)
    const totalKey = table ? `${line.documentId}:${table.templateName ?? table.id}` : undefined
    const contribution =
      parsedTotal === undefined || !totalColumn
        ? undefined
        : totalColumn.behavior === 'subtract'
          ? -Math.abs(parsedTotal)
          : Math.abs(parsedTotal)
    let runningTotal: number | undefined
    if (totalKey && contribution !== undefined) {
      const nextTotal = (runningTotals.get(totalKey) ?? 0) + contribution
      runningTotals.set(totalKey, nextTotal)
      runningTotal = nextTotal
    }

    return {
      id: `${line.id}:entry`,
      rawText: line.text,
      normalizedText: financialText.replace(/\s+/g, ' ').trim(),
      ...(payee ? { payee } : {}),
      source: 'parser',
      status: 'maybe',
      confidence,
      ...(accounting
        ? {
            category: accounting.category,
            ...(accounting.numericValue === undefined
              ? {}
              : { numericValue: accounting.numericValue }),
            ...(accounting.date ? { date: accounting.date } : {})
          }
        : semantic
          ? { category: semantic.kind }
          : {}),
      ...(contribution === undefined ? {} : { totalContribution: contribution }),
      ...(runningTotal === undefined ? {} : { runningTotal }),
      regions: [
        {
          documentId: line.documentId,
          pageNumber: line.pageNumber,
          bbox: line.bbox,
          ...(table ? { tableId: table.id, rowIndex: table.rowLineIds.indexOf(line.id) } : {})
        }
      ],
      tags: [
        ...(semantic ? [`semantic:${semantic.kind}`] : []),
        ...(accounting?.tags ?? []),
        ...(table ? ['table-row'] : [])
      ],
      createdAt: timestamp,
      updatedAt: timestamp
    }
  })
}
