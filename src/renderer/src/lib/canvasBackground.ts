import type { KeptEntriesBackground } from '../../../shared/keptEntriesLayout'

export const MIN_BACKGROUND_SIZE = 16

function resize(
  background: KeptEntriesBackground,
  width: number,
  height: number
): KeptEntriesBackground {
  return {
    ...background,
    width: Math.max(MIN_BACKGROUND_SIZE, Math.round(width)),
    height: Math.max(MIN_BACKGROUND_SIZE, Math.round(height))
  }
}

export function scaleBackground(
  background: KeptEntriesBackground,
  factor: number
): KeptEntriesBackground {
  if (!Number.isFinite(factor) || factor <= 0) return background
  return resize(background, background.width * factor, background.height * factor)
}

/** Resizes one edge and derives the other from the current ratio so the image never distorts. */
export function resizeBackgroundEdge(
  background: KeptEntriesBackground,
  edge: 'width' | 'height',
  value: number,
  lockAspectRatio: boolean
): KeptEntriesBackground {
  const next = Math.max(MIN_BACKGROUND_SIZE, value)
  if (!lockAspectRatio) return resize(background, ...edgeSizes(background, edge, next))
  const ratio = background.width / background.height
  if (!Number.isFinite(ratio) || ratio <= 0) return background
  return edge === 'width'
    ? resize(background, next, next / ratio)
    : resize(background, next * ratio, next)
}

function edgeSizes(
  background: KeptEntriesBackground,
  edge: 'width' | 'height',
  value: number
): [number, number] {
  return edge === 'width' ? [value, background.height] : [background.width, value]
}

/** Contain-fits the image to the page and centres it, so nothing is cropped or stretched. */
export function fitBackgroundToPage(
  background: KeptEntriesBackground,
  pageWidth: number,
  pageHeight: number
): KeptEntriesBackground {
  if (!(background.width > 0) || !(background.height > 0)) return background
  const scale = Math.min(pageWidth / background.width, pageHeight / background.height)
  const next = scaleBackground(background, scale)
  return {
    ...next,
    x: Math.max(0, (pageWidth - next.width) / 2),
    y: Math.max(0, (pageHeight - next.height) / 2)
  }
}
