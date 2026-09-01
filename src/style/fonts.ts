import type { TextStyleWeight } from '../shared/contracts'

export interface NormalizedFontName {
  sourceName?: string
  fontFamily: string
  fontFace?: string
  fontWeight: TextStyleWeight
  italic: boolean
}

const SUBSET_PREFIX = /^[A-Z]{6}\+/
const SEPARATORS = /[-_,]+/g

function stripExtension(value: string): string {
  return value.replace(/\.(?:otf|ttf|woff2?)$/i, '')
}

function wordsFromName(value: string): string[] {
  return stripExtension(value.replace(SUBSET_PREFIX, ''))
    .replace(SEPARATORS, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join(' ')
}

function inferWeight(tokens: readonly string[]): TextStyleWeight {
  const joined = tokens.join(' ').toLocaleLowerCase()
  if (/\b(?:semi\s*bold|demi\s*bold)\b/.test(joined)) return 'semibold'
  if (/\b(?:black|heavy|extra\s*bold|ultra\s*bold|bold)\b/.test(joined)) return 'bold'
  if (/\bmedium\b/.test(joined)) return 'medium'
  if (/\b(?:regular|roman|book|normal)\b/.test(joined)) return 'regular'
  return 'unknown'
}

export function normalizePdfFontName(fontName?: string): NormalizedFontName {
  const sourceName = fontName?.trim() || undefined
  if (!sourceName) {
    return { fontFamily: 'Unknown', fontWeight: 'unknown', italic: false }
  }

  const tokens = wordsFromName(sourceName)
  if (tokens.length === 0) {
    return { sourceName, fontFamily: 'Unknown', fontWeight: 'unknown', italic: false }
  }

  const italic = tokens.some((token) => /^(?:italic|oblique)$/i.test(token))
  const fontWeight = inferWeight(tokens)
  const styleWords = new Set([
    'regular',
    'roman',
    'book',
    'normal',
    'medium',
    'semi',
    'semibold',
    'demi',
    'demibold',
    'bold',
    'extra',
    'ultra',
    'black',
    'heavy',
    'italic',
    'oblique'
  ])
  const familyTokens = tokens.filter((token) => !styleWords.has(token.toLocaleLowerCase()))
  const fontFamily = titleCase((familyTokens.length > 0 ? familyTokens : tokens).join(' '))
  const faceTokens = tokens.filter((token) => styleWords.has(token.toLocaleLowerCase()))
  const fontFace = faceTokens.length > 0 ? titleCase(faceTokens.join(' ')) : undefined

  return { sourceName, fontFamily, fontFace, fontWeight, italic }
}

export function approximateFontSize(transform: readonly number[], height: number): number {
  const verticalScale = Math.hypot(Number(transform[2] ?? 0), Number(transform[3] ?? 0))
  const fallback = Number.isFinite(height) ? Math.abs(height) : 0
  const size = verticalScale > 0 ? verticalScale : fallback
  return Math.round(size * 10) / 10
}

export function fontSizeBucket(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 0
  return Math.round(size * 2) / 2
}
