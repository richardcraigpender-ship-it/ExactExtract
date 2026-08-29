import type { ProjectState } from '../../../shared/contracts'
import { upgradeKeptEntriesLayout } from '../../../shared/keptEntriesLayout'
import {
  DEFAULT_KEPT_ENTRIES_LAYOUT,
  type KeptEntriesCanvasLayout,
  type KeptEntryPlacement
} from './keptEntriesLayout'

export function restoreKeptEntriesLayout(
  project: Pick<ProjectState, 'keptEntriesLayout'>
): KeptEntriesCanvasLayout {
  const layout = project.keptEntriesLayout
  if (!layout || (layout.version !== 1 && layout.version !== 2)) {
    return { ...DEFAULT_KEPT_ENTRIES_LAYOUT, placements: [] }
  }
  return {
    ...upgradeKeptEntriesLayout(layout),
    placements: layout.placements.map((placement) => ({ ...placement })),
    images: layout.images?.map((placement) => ({ ...placement })),
    background: layout.background ? { ...layout.background } : undefined
  }
}

export function updatePlacementPosition(
  placement: KeptEntryPlacement,
  deltaX: number,
  deltaY: number,
  pageWidth: number,
  pageHeight: number
): KeptEntryPlacement {
  const maxX = Math.max(0, pageWidth - placement.width)
  const maxY = Math.max(0, pageHeight - placement.height)
  return {
    ...placement,
    x: Math.max(0, Math.min(maxX, placement.x + deltaX)),
    y: Math.max(0, Math.min(maxY, placement.y + deltaY))
  }
}

export function nudgePlacement(
  placement: KeptEntryPlacement,
  direction: 'left' | 'right' | 'up' | 'down',
  pageWidth: number,
  pageHeight: number,
  step = 2
): KeptEntryPlacement {
  const delta = {
    left: [-step, 0],
    right: [step, 0],
    up: [0, -step],
    down: [0, step]
  }[direction]
  return updatePlacementPosition(placement, delta[0], delta[1], pageWidth, pageHeight)
}
