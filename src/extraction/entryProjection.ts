import type { ProjectEntry } from '../shared/contracts'
import { extractAccountingLineDetails } from './accounting'
import { classifySemanticLines } from './semantics'
import { adaptRevolutTransaction, isRevolutStatement } from './revolutAdapter'
import type { ExtractedLine, ParserExtractionResult } from './types'

/**
 * Detail lines sit directly beneath their transaction row, so a continuation is only claimed
 * while it stays vertically adjacent to the previous line of the same row. Reference text is
 * often set in a smaller face than the row, so a smaller line is allowed a wider gap before the
 * chain is broken.
 */
function verticallyAdjacent(
  anchor: ExtractedLine,
  previous: ExtractedLine,
  candidate: ExtractedLine
): boolean {
  const gap = Math.abs(candidate.bbox.y - previous.bbox.y)
  const smallerThanRow =
    anchor.bbox.height > 0 &&
    candidate.bbox.height > 0 &&
    candidate.bbox.height <= anchor.bbox.height * 0.95
  const allowance = smallerThanRow ? 3.5 : 2.5
  return gap <= Math.max(previous.bbox.height, candidate.bbox.height) * allowance
}

/**
 * Groups the untabulated lines under the transaction row they belong to, so the reference and
 * address text printed beneath a payee survives instead of being dropped with the row filter.
 */
export function collectTransactionContinuationLines(
  lines: readonly ExtractedLine[],
  transactionLineIds: ReadonlySet<string>
): Map<string, ExtractedLine[]> {
  const continuations = new Map<string, ExtractedLine[]>()
  let anchor: ExtractedLine | undefined
  let previous: ExtractedLine | undefined

  for (const line of lines) {
    if (transactionLineIds.has(line.id)) {
      anchor = line
      previous = line
      continue
    }
    if (!anchor || !previous) continue
    if (line.documentId !== anchor.documentId || line.pageNumber !== anchor.pageNumber) {
      anchor = undefined
      previous = undefined
      continue
    }
    if (!verticallyAdjacent(anchor, previous, line)) {
      // A large gap means the page has moved on to totals or footer text.
      anchor = undefined
      previous = undefined
      continue
    }
    continuations.set(anchor.id, [...(continuations.get(anchor.id) ?? []), line])
    previous = line
  }

  return continuations
}

function parseTotalValue(text: string): number | undefined {
  const normalized = text.replace(/\s/g, '').replace(/,/g, '')
  const match = normalized.match(/\(?-?\d+(?:\.\d+)?\)?/)
  if (!match) return undefined
  const value = Number(match[0].replace(/[()]/g, ''))
  if (!Number.isFinite(value)) return undefined
  return normalized.startsWith('(') || normalized.startsWith('-') ? -Math.abs(value) : value
}

const DATE_PREFIX =
  /^(?:\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?[/-]\d{1,2}[/-]\d{2,4})\s+/i
const FIRST_AMOUNT = /(?:[$€£¥₹]\s*)?\(?[+-]?\d/
const PERSONAL_HONORIFIC = /^(?:mr|mrs|ms|miss|dr|prof)\.?\s+/i
const TRAILING_DIRECTION_WORDS = /\s+(?:money\s+(?:in|out)|debit|credit|in|out)\s*$/i
const INCOMPLETE_TRANSACTION_DESCRIPTION =
  /^(?:payment\s+(?:from|to)|transfer\s+(?:from|to)|from|to)$/i
const REFERENCE_DETAIL_LINE =
  /\b(?:ref(?:erence)?|card|invoice|inv|order|po|receipt|transaction|txn|id)\b/i

function cleanDescriptionText(value: string): string {
  return value.replace(TRAILING_DIRECTION_WORDS, '').replace(/\s+/g, ' ').trim()
}

function completeFinancialText(
  text: string,
  continuation: readonly ExtractedLine[]
): { text: string; consumedContinuationCount: number } {
  const dateMatch = text.match(DATE_PREFIX)
  const descriptionStart = dateMatch ? dateMatch[0].length : 0
  const withoutDate = text.slice(descriptionStart)
  const firstAmountIndex = withoutDate.search(FIRST_AMOUNT)
  if (firstAmountIndex <= 0) return { text, consumedContinuationCount: 0 }

  const description = cleanDescriptionText(withoutDate.slice(0, firstAmountIndex))
  if (!INCOMPLETE_TRANSACTION_DESCRIPTION.test(description)) {
    return { text, consumedContinuationCount: 0 }
  }

  const descriptionLines: string[] = []
  for (const line of continuation) {
    const normalized = line.text.replace(/\s+/g, ' ').trim()
    if (!normalized) continue
    if (REFERENCE_DETAIL_LINE.test(normalized)) break
    descriptionLines.push(normalized)
  }
  if (descriptionLines.length === 0) return { text, consumedContinuationCount: 0 }

  const amountStart = descriptionStart + firstAmountIndex
  return {
    text: `${text.slice(0, amountStart).trimEnd()} ${descriptionLines.join(' ')} ${text
      .slice(amountStart)
      .trimStart()}`,
    consumedContinuationCount: descriptionLines.length
  }
}

export function extractFinancialPayee(
  text: string,
  accountingDocument: boolean
): string | undefined {
  if (!accountingDocument) return undefined
  const withoutDate = text.replace(DATE_PREFIX, '')
  const firstAmountIndex = withoutDate.search(FIRST_AMOUNT)
  if (firstAmountIndex <= 0) return undefined
  const payee = cleanDescriptionText(withoutDate.slice(0, firstAmountIndex))
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
  const useTransactionLines =
    result.classification.kind === 'tabular' && transactionLines.length >= 2
  const lines = useTransactionLines ? transactionLines : result.lines
  // Only the filtered path drops lines, so it is the only path that needs them reattached.
  const continuationLines = useTransactionLines
    ? collectTransactionContinuationLines(
        result.lines,
        new Set(transactionLines.map((line) => line.id))
      )
    : new Map<string, ExtractedLine[]>()
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
    const continuation = continuationLines.get(line.id) ?? []
    const completed = completeFinancialText(line.text, continuation)
    const adaptedText = revolutStatement
      ? adaptRevolutTransaction(completed.text, previousRevolutBalance)
      : undefined
    const financialText = adaptedText ?? completed.text
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
    // Captured verbatim so the exported reference matches the source instead of a parsed token.
    const referenceText = continuation
      .slice(completed.consumedContinuationCount)
      .map((detail) => detail.text.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
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
      ...(referenceText ? { reference: referenceText } : {}),
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
