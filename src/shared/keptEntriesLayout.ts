export type KeptEntriesPageSize = 'letter' | 'a4'
export type KeptEntriesOrientation = 'portrait' | 'landscape'
export type KeptEntriesFontRef =
  | { kind: 'standard-14'; family: 'Helvetica' | 'Helvetica-Bold' | 'Times-Roman' | 'Courier' }
  | { kind: 'system'; family: string; style?: string }

export interface KeptEntryPlacement {
  id: string
  entryId?: string
  text: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fontRef: KeptEntriesFontRef
  fontSize: number
  color: string
}

export interface KeptEntriesBackground {
  dataUrl: string
  x: number
  y: number
  width: number
  height: number
  opacity: number
}

export interface KeptEntriesCanvasLayout {
  version: 1
  pageSize: KeptEntriesPageSize
  orientation: KeptEntriesOrientation
  placements: KeptEntryPlacement[]
  background?: KeptEntriesBackground
}
