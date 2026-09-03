import type {
  KeptExportPageNumberAnchor,
  KeptExportPageNumbers
} from '../shared/keptExportTemplate'

export interface PageNumberDraw {
  text: string
  x: number
  y: number
  fontSize: number
}

export function formatPageNumberText(
  template: string,
  pageIndex: number,
  startAt: number,
  totalPages: number
): string {
  const displayNumber = startAt + (pageIndex - 1)
  return template.replace(/\{n\}/g, `${displayNumber}`).replace(/\{total\}/g, `${totalPages}`)
}

export function resolvePageNumberPosition(
  anchor: KeptExportPageNumberAnchor,
  offsetX: number,
  offsetY: number,
  pageWidth: number,
  pageHeight: number,
  textWidth: number
): { x: number; y: number } {
  const y = anchor.startsWith('bottom') ? offsetY : pageHeight - offsetY
  const x = anchor.endsWith('left')
    ? offsetX
    : anchor.endsWith('right')
      ? pageWidth - offsetX - textWidth
      : (pageWidth - textWidth) / 2 + offsetX
  return { x, y }
}

export function buildPageNumberDraw(
  config: KeptExportPageNumbers,
  pageIndex: number,
  totalPages: number,
  pageWidth: number,
  pageHeight: number,
  measureTextWidth: (text: string, fontSize: number) => number
): PageNumberDraw | undefined {
  if (!config.enabled) return undefined
  const fontSize = Math.max(1, config.textStyle.fontSize * config.scale)
  const text = formatPageNumberText(
    config.format.template,
    pageIndex,
    config.format.startAt,
    totalPages
  )
  const textWidth = measureTextWidth(text, fontSize)
  const { x, y } = resolvePageNumberPosition(
    config.anchor,
    config.offsetX,
    config.offsetY,
    pageWidth,
    pageHeight,
    textWidth
  )
  return { text, x, y, fontSize }
}
