import { classifyPage } from './classification'
import { detectDocumentKind } from './documentKind'
import { groupPageLines } from './layout'
import { buildDocumentPreflight } from './preflight'
import { detectTableCandidates } from './tables'
import { parseTextLayerPage } from './textLayer'
import { detectDocumentStyleProfile } from '../style'
import type { ParserExtractionResult, TableTemplate, TextLayerPageInput } from './types'

export function extractDocumentTextLayer(
  documentId: string,
  pageInputs: readonly TextLayerPageInput[],
  completedAt?: string,
  tableTemplate?: TableTemplate
): ParserExtractionResult {
  if (pageInputs.some((page) => page.documentId !== documentId)) {
    throw new Error('All page inputs must belong to documentId.')
  }

  const pages = pageInputs.map(parseTextLayerPage).map(classifyPage)
  const lines = pages.flatMap((page) => groupPageLines(page))
  const tables = pages.flatMap((page) =>
    detectTableCandidates(
      page,
      lines.filter((line) => line.pageNumber === page.pageNumber),
      12,
      tableTemplate
    )
  )
  const classification = detectDocumentKind(pages)
  const preflight = buildDocumentPreflight(documentId, pages, completedAt)
  const styleProfile = detectDocumentStyleProfile(documentId, pageInputs, completedAt)

  return {
    documentId,
    styleProfile,
    pages,
    blocks: pages.flatMap((page) => page.blocks),
    lines,
    tables,
    classification,
    preflight
  }
}
