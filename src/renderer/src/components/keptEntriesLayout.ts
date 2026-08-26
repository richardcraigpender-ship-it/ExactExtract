import type { ProjectEntry } from '../../../shared/contracts'
export type {
  KeptEntriesCanvasLayout,
  KeptEntriesFontRef,
  KeptEntriesOrientation,
  KeptEntriesPageSize,
  KeptEntriesBackground,
  KeptEntryPlacement
} from '../../../shared/keptEntriesLayout'
import type { KeptEntriesCanvasLayout, KeptEntryPlacement } from '../../../shared/keptEntriesLayout'

export const DEFAULT_KEPT_ENTRIES_LAYOUT: KeptEntriesCanvasLayout = {
  version: 1,
  pageSize: 'letter',
  orientation: 'portrait',
  placements: [],
  background: undefined
}

export function createKeptEntryPlacement(entry: ProjectEntry, index: number): KeptEntryPlacement {
  return {
    id: `kept-entry-${entry.id}`,
    entryId: entry.id,
    text: entry.normalizedText,
    x: 48,
    y: 48 + index * 36,
    width: 516,
    height: 28,
    rotation: 0,
    fontRef: { kind: 'standard-14', family: 'Helvetica' },
    fontSize: 11,
    color: '#17231c'
  }
}

export function createDefaultKeptEntriesLayout(
  entries: readonly ProjectEntry[]
): KeptEntriesCanvasLayout {
  return {
    ...DEFAULT_KEPT_ENTRIES_LAYOUT,
    placements: entries
      .filter((entry) => entry.status === 'keep')
      .map((entry, index) => createKeptEntryPlacement(entry, index))
  }
}
