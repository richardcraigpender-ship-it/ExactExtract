/**
 * Renders a short text label (a running-balance value) to a PNG so it sits alongside kept-entry
 * image crops as an actual image rather than vector PDF text, keeping the row visually uniform.
 */
export interface TextLabelImage {
  dataUrl: string
  width: number
  height: number
}

const LABEL_PADDING_X = 6
const LABEL_PADDING_Y = 4
/** Matches the sharpened entry-crop rasterization scale so both look equally crisp. */
const LABEL_SCALE = 6

export function renderTextLabelPng(
  text: string,
  options: {
    fontSize: number
    color: string
    fontFamily?: string
    fontWeight?: string
    backgroundColor?: string
  }
): TextLabelImage | undefined {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return undefined
  }
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const fontSize = Math.max(6, options.fontSize)

  const rawWeight = (options.fontWeight ?? '600').toLowerCase()
  const weight =
    rawWeight === 'bold' || rawWeight === '700'
      ? '700'
      : rawWeight === 'regular' || rawWeight === 'normal' || rawWeight === '400'
        ? '400'
        : '600'

  const family = options.fontFamily?.trim() || 'Helvetica'
  const fontStack = family.includes(',') ? family : `"${family.replaceAll('"', '\\"')}", sans-serif`

  const font = `${weight} ${fontSize}px ${fontStack}`

  const measuringCanvas = document.createElement('canvas')
  const measuringContext = measuringCanvas.getContext('2d')
  if (!measuringContext) return undefined
  measuringContext.font = font
  const textWidth = measuringContext.measureText(trimmed).width

  const width = Math.max(1, Math.ceil(textWidth + LABEL_PADDING_X * 2))
  const height = Math.max(1, Math.ceil(fontSize * 1.3 + LABEL_PADDING_Y * 2))

  const canvas = document.createElement('canvas')
  canvas.width = width * LABEL_SCALE
  canvas.height = height * LABEL_SCALE
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.scale(LABEL_SCALE, LABEL_SCALE)

  const bgColor = options.backgroundColor?.trim().toLowerCase()
  if (bgColor && bgColor !== 'transparent' && bgColor !== 'none') {
    context.fillStyle = options.backgroundColor!
    context.fillRect(0, 0, width, height)
  }

  context.font = font
  context.fillStyle = options.color
  context.textBaseline = 'middle'
  context.fillText(trimmed, LABEL_PADDING_X, height / 2)

  return { dataUrl: canvas.toDataURL('image/png'), width, height }
}
