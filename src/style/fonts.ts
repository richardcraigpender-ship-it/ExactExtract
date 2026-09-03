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
const PRODUCER_SUFFIXES = /(?:mt|ps|psmt|std|pro|lt|w0[12]|itc|ot|tt|regular)$/i
const PRODUCER_SUFFIX_TOKENS = new Set([
  'mt',
  'ps',
  'psmt',
  'std',
  'pro',
  'lt',
  'w01',
  'w02',
  'itc',
  'ot',
  'tt'
])

const FAMILY_ALIASES: ReadonlyArray<{ pattern: RegExp; family: string }> = [
  { pattern: /^(?:arial|arialmt|arialunicode(?:ms)?)$/i, family: 'Arial' },
  { pattern: /^(?:aptos|aptosdisplay|aptosmono|aptosserif)$/i, family: 'Aptos' },
  { pattern: /^(?:calibri|calibrilight|calibrimath)$/i, family: 'Calibri' },
  { pattern: /^(?:cambria|cambriamath)$/i, family: 'Cambria' },
  { pattern: /^(?:candara|consolas|constantia|corbel)$/i, family: 'Candara' },
  { pattern: /^(?:times(?:newroman)?|timesroman|timesnewromanpsmt)$/i, family: 'Times New Roman' },
  { pattern: /^(?:helvetica(?:neue)?|helveticaneue(?:lt|std)?)$/i, family: 'Helvetica' },
  { pattern: /^(?:courier(?:new)?|couriernewpsmt)$/i, family: 'Courier New' },
  { pattern: /^(?:georgia|verdana|tahoma|trebuchetms)$/i, family: 'Georgia' },
  { pattern: /^(?:garamond|adobegaramondpro|minionpro)$/i, family: 'Garamond' },
  {
    pattern: /^(?:myriad(?:pro)?|acumin(?:pro)?|museo|tradegothic|din|itcfranklingothic)$/i,
    family: 'Myriad'
  },
  { pattern: /^(?:frutiger|univers|futura|gill(?:sans)?|avenir)$/i, family: 'Avenir' },
  { pattern: /^(?:roboto|robotocondensed|robotoslab)$/i, family: 'Roboto' },
  { pattern: /^(?:inter|ubuntu|ptsans|raleway|oswald|firasans|firacode)$/i, family: 'Inter' },
  { pattern: /^(?:open(?:sans)?|opensans)$/i, family: 'Open Sans' },
  { pattern: /^(?:source(?:sans|serif|code)(?:pro)?)$/i, family: 'Source Sans' },
  {
    pattern: /^(?:noto(?:sans|serif|mono)?(?:cjk|arabic|devanagari|thai|naskharabic)?)$/i,
    family: 'Noto'
  },
  {
    pattern: /^(?:msmincho|mspgothic|yugothic|meiryo|simsun|simhei|pingfang|hiragino)$/i,
    family: 'CJK system font'
  },
  { pattern: /^(?:amiri|arialhebrew|mangal|kohinoor)$/i, family: 'Regional system font' },
  { pattern: /^(?:liberation(?:sans|serif|mono)?)$/i, family: 'Liberation' },
  { pattern: /^(?:dejavu(?:sans|serif|mono)?)$/i, family: 'DejaVu' },
  { pattern: /^(?:montserrat|lato|poppins|merriweather|playfairdisplay)$/i, family: 'Montserrat' },
  { pattern: /^(?:segoeui|segoeuisemibold|segoeuibold|segoeprint)$/i, family: 'Segoe UI' }
]

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

function knownFamily(tokens: readonly string[]): string | undefined {
  const compact = tokens.join('')
  const variants = [compact]
  let stripped = compact
  while (PRODUCER_SUFFIXES.test(stripped)) {
    stripped = stripped.replace(PRODUCER_SUFFIXES, '')
    variants.push(stripped)
  }
  return FAMILY_ALIASES.find(({ pattern }) => variants.some((variant) => pattern.test(variant)))
    ?.family
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
  const aliasTokens = tokens.filter((token) => {
    const normalized = token.toLocaleLowerCase()
    return (
      !PRODUCER_SUFFIX_TOKENS.has(normalized) &&
      (!styleWords.has(normalized) || normalized === 'roman')
    )
  })
  const familyTokens = tokens.filter((token) => {
    const normalized = token.toLocaleLowerCase()
    return !styleWords.has(normalized) && !PRODUCER_SUFFIX_TOKENS.has(normalized)
  })
  const fontFamily =
    knownFamily(aliasTokens) ??
    knownFamily(familyTokens) ??
    titleCase((familyTokens.length > 0 ? familyTokens : tokens).join(' '))
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
