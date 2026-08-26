export interface ViewerHighlight {
  entryNumber?: number
  regionIndex?: number
  page: number
  x: number
  y: number
  width: number
  height: number
  status?: 'keep' | 'maybe' | 'exclude'
  selected?: boolean
  checked?: boolean
  entryId?: string
}

export interface NormalizedViewerRegion {
  x: number
  y: number
  width: number
  height: number
}

export type ViewerRotation = 0 | 90 | 180 | 270

export function projectViewerRegion(
  region: NormalizedViewerRegion,
  rotation: ViewerRotation
): NormalizedViewerRegion {
  if (rotation === 90) {
    return {
      x: 1 - region.y - region.height,
      y: region.x,
      width: region.height,
      height: region.width
    }
  }
  if (rotation === 180) {
    return {
      x: 1 - region.x - region.width,
      y: 1 - region.y - region.height,
      width: region.width,
      height: region.height
    }
  }
  if (rotation === 270) {
    return {
      x: region.y,
      y: 1 - region.x - region.width,
      width: region.height,
      height: region.width
    }
  }
  return { ...region }
}

export function unprojectViewerRegion(
  region: NormalizedViewerRegion,
  rotation: ViewerRotation
): NormalizedViewerRegion {
  return projectViewerRegion(region, ((360 - rotation) % 360) as ViewerRotation)
}

export function describeViewerHighlight(highlight: ViewerHighlight): string {
  const percent = (value: number): number => Math.round(value * 100)
  return `Selected source region on page ${highlight.page}: ${percent(highlight.x)}% from the left, ${percent(highlight.y)}% from the top, ${percent(highlight.width)}% wide, and ${percent(highlight.height)}% high.`
}
