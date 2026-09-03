export { detectDocumentStyleProfile } from './detect'
export { clusterColours, nearestColourName, normalizeHexColour, rgbToHex } from './colors'
export { colourPaletteFromDividers, detectDividerStyles } from './dividers'
export { approximateFontSize, fontSizeBucket, normalizePdfFontName } from './fonts'
export {
  detectPageNumberStyle,
  pageNumberMatchToKeptExportPageNumbers,
  type DetectedPageNumberMatch,
  type PageNumberScanLine,
  type PageNumberScanPage
} from './pageNumbers'
