import type {
  DocumentStyleProfile,
  DocumentStyleWarning,
  PageStyleSummary,
  TextStyleCluster,
  TextStyleRole
} from '../shared/contracts'
import type { PdfTextItem, TextLayerPageInput } from '../extraction/types'
import { clusterColours } from './colors'
import { colourPaletteFromDividers, detectDividerStyles } from './dividers'
import { approximateFontSize, fontSizeBucket, normalizePdfFontName } from './fonts'

interface TextStyleAccumulator {
  id: string
  fontFamily: string
  fontFace?: string
  fontSize: number
  fontWeight: TextStyleCluster['fontWeight']
  italic: boolean
  occurrenceCount: number
  characterCount: number
  pageNumbers: Set<number>
  sampleText: string[]
  topBandCount: number
  bottomBandCount: number
}

function cleanSample(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function clusterId(parts: {
  fontFamily: string
  fontFace?: string
  fontSize: number
  fontWeight: string
  italic: boolean
}): string {
  return [
    parts.fontFamily,
    parts.fontFace ?? 'default',
    parts.fontSize.toFixed(1),
    parts.fontWeight,
    parts.italic ? 'italic' : 'upright'
  ]
    .join('|')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function itemTopY(item: PdfTextItem, pageHeight: number): number {
  const baseline = item.transform[5]
  const height = Math.max(0, item.height || Math.abs(item.transform[3]))
  const ascentRatio = Number.isFinite(item.fontAscentRatio) ? item.fontAscentRatio! : 0.8
  return pageHeight - (baseline + height * ascentRatio)
}

function likelyRole(cluster: TextStyleAccumulator, bodySize: number): TextStyleRole {
  const positionalCount = cluster.topBandCount + cluster.bottomBandCount
  if (cluster.fontSize <= bodySize * 0.82) return 'small-print'
  if (
    cluster.fontSize >= bodySize * 1.25 &&
    cluster.topBandCount >= cluster.occurrenceCount * 0.45
  ) {
    return 'header'
  }
  if (cluster.bottomBandCount >= cluster.occurrenceCount * 0.6 && positionalCount > 0)
    return 'footer'
  if (cluster.fontFamily.toLocaleLowerCase().includes('courier')) return 'table'
  if (cluster.fontSize === bodySize || cluster.characterCount > 100) return 'body'
  return 'unknown'
}

function confidenceFor(
  pages: readonly TextLayerPageInput[],
  clusters: readonly TextStyleCluster[]
): DocumentStyleProfile['confidence'] {
  if (clusters.length === 0) return 'low'
  const textPages = pages.filter((page) => page.items.some((item) => cleanSample(item.str)))
  const namedCount = clusters.filter((cluster) => cluster.fontFamily !== 'Unknown').length
  if (textPages.length === pages.length && namedCount > 0) return 'high'
  return namedCount > 0 ? 'medium' : 'low'
}

function buildWarnings(
  pages: readonly TextLayerPageInput[],
  missingFontNameCount: number,
  clusters: readonly TextStyleCluster[]
): DocumentStyleWarning[] {
  const warnings: DocumentStyleWarning[] = []
  const textItemCount = pages.reduce(
    (count, page) => count + page.items.filter((item) => cleanSample(item.str)).length,
    0
  )
  if (textItemCount === 0) {
    warnings.push({ code: 'no-text', message: 'No embedded PDF text was available to profile.' })
    if (pages.some((page) => (page.imageObjectCount ?? 0) > 0)) {
      warnings.push({
        code: 'image-only',
        message:
          'The document appears image-based; style detection can only produce a partial profile.'
      })
    }
  }
  if (missingFontNameCount > 0) {
    warnings.push({
      code: 'missing-font-name',
      message: `${missingFontNameCount} text item${missingFontNameCount === 1 ? '' : 's'} had no embedded font name.`
    })
  }
  if (clusters.length > 0) {
    const pagesWithoutVisualRules = pages.filter((page) => page.visualRules === undefined)
    if (pagesWithoutVisualRules.length > 0) {
      warnings.push({
        code: 'missing-operator-list',
        message:
          'PDF operator-list data was unavailable for at least one page; divider and colour detection are partial.'
      })
    }
  }
  return warnings
}

export function detectDocumentStyleProfile(
  documentId: string,
  pages: readonly TextLayerPageInput[],
  generatedAt = new Date().toISOString()
): DocumentStyleProfile {
  const accumulators = new Map<string, TextStyleAccumulator>()
  const pageClusterIds = new Map<number, Set<string>>()
  let missingFontNameCount = 0

  for (const page of pages) {
    pageClusterIds.set(page.pageNumber, new Set())
    for (const item of page.items) {
      const text = cleanSample(item.str)
      if (!text) continue
      if (!item.fontName) missingFontNameCount += 1
      const normalized = normalizePdfFontName(item.fontName)
      const fontSize = fontSizeBucket(approximateFontSize(item.transform, item.height))
      const id = clusterId({ ...normalized, fontSize })
      const accumulator = accumulators.get(id) ?? {
        id,
        fontFamily: normalized.fontFamily,
        fontFace: normalized.fontFace,
        fontSize,
        fontWeight: normalized.fontWeight,
        italic: normalized.italic,
        occurrenceCount: 0,
        characterCount: 0,
        pageNumbers: new Set<number>(),
        sampleText: [],
        topBandCount: 0,
        bottomBandCount: 0
      }
      accumulator.occurrenceCount += 1
      accumulator.characterCount += text.length
      accumulator.pageNumbers.add(page.pageNumber)
      if (accumulator.sampleText.length < 3 && !accumulator.sampleText.includes(text)) {
        accumulator.sampleText.push(text)
      }
      const topY = itemTopY(item, page.height)
      if (topY <= page.height * 0.18) accumulator.topBandCount += 1
      if (topY >= page.height * 0.82) accumulator.bottomBandCount += 1
      accumulators.set(id, accumulator)
      pageClusterIds.get(page.pageNumber)?.add(id)
    }
  }

  const body = [...accumulators.values()].sort(
    (left, right) => right.characterCount - left.characterCount || left.fontSize - right.fontSize
  )[0]
  const bodySize = body?.fontSize ?? 0
  const textStyles = [...accumulators.values()]
    .map((cluster): TextStyleCluster => {
      const role = bodySize > 0 ? likelyRole(cluster, bodySize) : 'unknown'
      return {
        id: cluster.id,
        fontFamily: cluster.fontFamily,
        ...(cluster.fontFace ? { fontFace: cluster.fontFace } : {}),
        fontSize: cluster.fontSize,
        fontWeight: cluster.fontWeight,
        italic: cluster.italic,
        underline: false,
        role,
        likelyRole: role,
        occurrenceCount: cluster.occurrenceCount,
        characterCount: cluster.characterCount,
        pageNumbers: [...cluster.pageNumbers].sort((left, right) => left - right),
        sampleText: cluster.sampleText
      }
    })
    .sort(
      (left, right) => right.characterCount - left.characterCount || left.id.localeCompare(right.id)
    )

  const pageSummaries: PageStyleSummary[] = pages.map((page) => {
    const styleIds = [...(pageClusterIds.get(page.pageNumber) ?? [])].sort()
    const dominantTextStyleId = textStyles
      .filter((cluster) => styleIds.includes(cluster.id))
      .sort((left, right) => right.characterCount - left.characterCount)[0]?.id
    return {
      pageNumber: page.pageNumber,
      textStyleClusterIds: styleIds,
      ...(dominantTextStyleId ? { dominantTextStyleId } : {}),
      imageObjectCount: Math.max(0, Math.trunc(page.imageObjectCount ?? 0)),
      characterCount: page.items.reduce((count, item) => count + cleanSample(item.str).length, 0)
    }
  })

  const warnings = buildWarnings(pages, missingFontNameCount, textStyles)
  const dividerStyles = detectDividerStyles(pages)
  const colourPalette = clusterColours([
    ...textStyles.flatMap((style) =>
      Array.from({ length: style.occurrenceCount }, () => ({
        hex: style.colour?.hex,
        role: 'text' as const
      }))
    ),
    ...colourPaletteFromDividers(dividerStyles).map((colour) => ({
      hex: colour.hex,
      role: colour.likelyRole
    }))
  ])

  return {
    id: `${documentId}:style:v1`,
    documentId,
    generatedAt,
    detectorVersion: 1,
    source: textStyles.length === 0 ? 'ocr-image' : 'pdf-text',
    confidence: confidenceFor(pages, textStyles),
    textStyles,
    dividerStyles,
    colourPalette,
    pageSummaries,
    warnings
  }
}
