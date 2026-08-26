import type { DocumentPreflightResult, ExtractionSettings } from '../shared/contracts'

export interface ExtractionPlan {
  documentId: string
  mode: ExtractionSettings['mode']
  parserPages: number[]
  ocrPages: number[]
  ocrLanguages: string[]
}

function sortedUnique(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right)
}

export function createExtractionPlan(
  preflight: DocumentPreflightResult,
  settings: ExtractionSettings
): ExtractionPlan {
  if (preflight.documentId.trim().length === 0) throw new Error('documentId is required.')

  const parserPages = sortedUnique(preflight.pages.map((page) => page.pageNumber))
  const availablePages = new Set(parserPages)
  const selectedPages = sortedUnique(settings.selectedPages ?? [])
  if (selectedPages.some((page) => !Number.isInteger(page) || !availablePages.has(page))) {
    throw new Error('Selected OCR pages must exist in the document preflight.')
  }

  let ocrPages: number[]
  switch (settings.mode) {
    case 'fast':
      ocrPages = preflight.pages
        .filter((page) => page.characterCount === 0)
        .map((page) => page.pageNumber)
      break
    case 'balanced':
      ocrPages = preflight.pages
        .filter((page) => page.ocrRecommended)
        .map((page) => page.pageNumber)
      break
    case 'maximum':
      ocrPages = parserPages
      break
    case 'custom':
      ocrPages = selectedPages
      break
  }

  return {
    documentId: preflight.documentId,
    mode: settings.mode,
    parserPages,
    ocrPages: sortedUnique(ocrPages),
    ocrLanguages: [...settings.ocrLanguages]
  }
}
