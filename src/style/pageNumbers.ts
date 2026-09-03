import type { BoundingBox, DocumentStyleProfile } from '../shared/contracts'
import { textStyleToKeptExportTextStyle } from '../shared/documentStyle'
import {
  DEFAULT_KEPT_EXPORT_PAGE_NUMBERS,
  type KeptExportPageNumberAnchor,
  type KeptExportPageNumberFormat,
  type KeptExportPageNumbers,
  type KeptExportTextStyle
} from '../shared/keptExportTemplate'

export interface PageNumberScanLine {
  text: string
  bbox: BoundingBox
}

export interface PageNumberScanPage {
  pageNumber: number
  width: number
  height: number
  lines: readonly PageNumberScanLine[]
}

export interface DetectedPageNumberMatch {
  anchor: KeptExportPageNumberAnchor
  offsetX: number
  offsetY: number
  format: KeptExportPageNumberFormat
  textStyle: KeptExportTextStyle
  matchedPageCount: number
  totalPageCount: number
}

type HorizontalBand = 'left' | 'center' | 'right'
type VerticalBand = 'top' | 'bottom'

interface LineMatch {
  prefix: string
  number: number
  separator?: string
  total?: number
}

interface Candidate {
  pageNumber: number
  match: LineMatch
  bbox: BoundingBox
  vertical: VerticalBand
  horizontal: HorizontalBand
}

const EDGE_MARGIN_RATIO = 0.12
const BAND_PRIORITY: readonly VerticalBand[] = ['bottom', 'top']
const HORIZONTAL_PRIORITY: readonly HorizontalBand[] = ['center', 'left', 'right']

function matchPageNumberLine(text: string): LineMatch | null {
  const cleaned = text
    .trim()
    .replace(/^[-–—\s]+|[-–—\s]+$/g, '')
    .trim()
  const match = /^(page\s+)?(\d{1,4})(?:\s*(of|\/)\s*(\d{1,4}))?$/i.exec(cleaned)
  if (!match) return null
  return {
    prefix: match[1] ?? '',
    number: Number(match[2]),
    separator: match[3] ? (match[3].toLowerCase() === 'of' ? ' of ' : ' / ') : undefined,
    total: match[4] ? Number(match[4]) : undefined
  }
}

function horizontalBand(bbox: BoundingBox, pageWidth: number): HorizontalBand {
  const centerX = bbox.x + bbox.width / 2
  if (centerX < pageWidth / 3) return 'left'
  if (centerX > (pageWidth * 2) / 3) return 'right'
  return 'center'
}

function verticalBand(bbox: BoundingBox, pageHeight: number): VerticalBand | null {
  const margin = pageHeight * EDGE_MARGIN_RATIO
  if (bbox.y <= margin) return 'bottom'
  if (pageHeight - (bbox.y + bbox.height) <= margin) return 'top'
  return null
}

function collectCandidates(pages: readonly PageNumberScanPage[]): Candidate[] {
  const candidates: Candidate[] = []
  for (const page of pages) {
    for (const line of page.lines) {
      const match = matchPageNumberLine(line.text)
      if (!match) continue
      const vertical = verticalBand(line.bbox, page.height)
      if (!vertical) continue
      candidates.push({
        pageNumber: page.pageNumber,
        match,
        bbox: line.bbox,
        vertical,
        horizontal: horizontalBand(line.bbox, page.width)
      })
    }
  }
  return candidates
}

function formatTemplate(match: LineMatch): KeptExportPageNumberFormat {
  const template =
    match.separator && match.total !== undefined
      ? `${match.prefix}{n}${match.separator}{total}`
      : `${match.prefix}{n}`
  return { template, startAt: 1 + (match.number - 1) }
}

function textStyleFromDetection(
  bboxHeight: number,
  matchedPages: readonly number[],
  styleProfile: DocumentStyleProfile | undefined
): KeptExportTextStyle {
  const cluster = styleProfile?.textStyles
    .filter((style) => style.pageNumbers.some((page) => matchedPages.includes(page)))
    .sort((left, right) => {
      const leftOverlap = left.pageNumbers.filter((page) => matchedPages.includes(page)).length
      const rightOverlap = right.pageNumbers.filter((page) => matchedPages.includes(page)).length
      return rightOverlap - leftOverlap
    })[0]
  if (cluster) return textStyleToKeptExportTextStyle(cluster)
  const fontSize = Math.max(6, Math.min(18, Math.round(bboxHeight)))
  return { ...DEFAULT_KEPT_EXPORT_PAGE_NUMBERS.textStyle, fontSize }
}

export function detectPageNumberStyle(
  pages: readonly PageNumberScanPage[],
  styleProfile?: DocumentStyleProfile
): DetectedPageNumberMatch | undefined {
  if (pages.length === 0) return undefined
  const candidates = collectCandidates(pages)
  if (candidates.length === 0) return undefined

  const groups = new Map<string, Candidate[]>()
  for (const candidate of candidates) {
    const key = `${candidate.vertical}-${candidate.horizontal}`
    const group = groups.get(key)
    if (group) group.push(candidate)
    else groups.set(key, [candidate])
  }

  const minimumCoverage = Math.max(2, Math.ceil(pages.length * 0.6))
  const slotPriority = (key: string): number => {
    const [vertical, horizontal] = key.split('-') as [VerticalBand, HorizontalBand]
    return (
      BAND_PRIORITY.indexOf(vertical) * HORIZONTAL_PRIORITY.length +
      HORIZONTAL_PRIORITY.indexOf(horizontal)
    )
  }

  let best: { key: string; candidates: Candidate[] } | undefined
  for (const [key, group] of groups) {
    if (group.length < minimumCoverage) continue
    const sorted = [...group].sort((left, right) => left.pageNumber - right.pageNumber)
    const offset = sorted[0].match.number - sorted[0].pageNumber
    const sameOffset = sorted.every(
      (candidate) => candidate.match.number - candidate.pageNumber === offset
    )
    const sameFormat = sorted.every(
      (candidate) =>
        Boolean(candidate.match.prefix) === Boolean(sorted[0].match.prefix) &&
        Boolean(candidate.match.separator) === Boolean(sorted[0].match.separator)
    )
    if (!sameOffset || !sameFormat) continue
    if (
      !best ||
      group.length > best.candidates.length ||
      (group.length === best.candidates.length && slotPriority(key) < slotPriority(best.key))
    ) {
      best = { key, candidates: sorted }
    }
  }

  if (!best) return undefined
  const [vertical, horizontal] = best.key.split('-') as [VerticalBand, HorizontalBand]
  const anchor = `${vertical}-${horizontal}` as KeptExportPageNumberAnchor
  const first = best.candidates[0]
  return buildMatch(anchor, horizontal, first, best.candidates, pages, styleProfile)
}

function buildMatch(
  anchor: KeptExportPageNumberAnchor,
  horizontal: HorizontalBand,
  first: Candidate,
  matched: readonly Candidate[],
  pages: readonly PageNumberScanPage[],
  styleProfile: DocumentStyleProfile | undefined
): DetectedPageNumberMatch {
  const page = pages.find((candidatePage) => candidatePage.pageNumber === first.pageNumber)
  const pageWidth = page?.width ?? 612
  const pageHeight = page?.height ?? 792
  const offsetY = anchor.startsWith('bottom')
    ? first.bbox.y
    : pageHeight - (first.bbox.y + first.bbox.height)
  const offsetX =
    horizontal === 'left'
      ? first.bbox.x
      : horizontal === 'right'
        ? pageWidth - (first.bbox.x + first.bbox.width)
        : first.bbox.x + first.bbox.width / 2 - pageWidth / 2
  const matchedPages = matched.map((candidate) => candidate.pageNumber)
  return {
    anchor,
    offsetX: Math.round(offsetX),
    offsetY: Math.round(offsetY),
    format: formatTemplate(first.match),
    textStyle: textStyleFromDetection(first.bbox.height, matchedPages, styleProfile),
    matchedPageCount: matched.length,
    totalPageCount: pages.length
  }
}

export function pageNumberMatchToKeptExportPageNumbers(
  match: DetectedPageNumberMatch
): KeptExportPageNumbers {
  return {
    enabled: true,
    matchSourceStyle: true,
    anchor: match.anchor,
    offsetX: match.offsetX,
    offsetY: match.offsetY,
    format: { ...match.format },
    textStyle: { ...match.textStyle, fontRef: { ...match.textStyle.fontRef } },
    scale: 1
  }
}
