import React from 'react'

import type { ProjectEntry } from '../../../shared/contracts'
import type { KeptEntriesCanvasLayout, KeptImageSourceRef } from '../../../shared/keptEntriesLayout'
import type { KeptExportTemplate } from '../../../shared/keptExportTemplate'
import { KeptCanvasStudioBody } from './KeptCanvasStudioBody'

interface KeptPngCanvasWorkspaceProps {
  entries: readonly ProjectEntry[]
  layout: KeptEntriesCanvasLayout
  keptExportTemplate?: KeptExportTemplate
  onLayoutChange: (layout: KeptEntriesCanvasLayout) => void
  onClose: () => void
  onExport: () => void
  onReset?: () => void
  onOpenConfiguration?: () => void
  onOpenTextConfiguration?: () => void
  onOpenPngConfiguration?: () => void
  onSwitchMode?: () => void
  isExporting?: boolean
  resolveImageSource?: (source: KeptImageSourceRef) => string | undefined
  imageResolutionError?: string
  onRefreshImages?: () => void
  isRefreshingImages?: boolean
}

/** PNG-mode entry point into the shared Canvas & layout studio. */
export function KeptPngCanvasWorkspace(props: KeptPngCanvasWorkspaceProps): React.JSX.Element {
  return <KeptCanvasStudioBody {...props} initialMode="png" />
}
