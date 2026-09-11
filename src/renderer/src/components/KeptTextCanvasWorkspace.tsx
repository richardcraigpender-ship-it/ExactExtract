import React from 'react'

import type { ProjectEntry } from '../../../shared/contracts'
import type { KeptEntriesCanvasLayout, KeptImageSourceRef } from '../../../shared/keptEntriesLayout'
import type { KeptExportRenderPlan, KeptExportTemplate } from '../../../shared/keptExportTemplate'
import { KeptCanvasStudioBody } from './KeptCanvasStudioBody'

interface KeptTextCanvasWorkspaceProps {
  entries: readonly ProjectEntry[]
  layout: KeptEntriesCanvasLayout
  keptExportTemplate?: KeptExportTemplate
  onTextTemplateChange?: (template: KeptExportTemplate) => void
  textRenderPlan?: KeptExportRenderPlan
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

/** Text-mode entry point into the shared Canvas & layout studio. */
export function KeptTextCanvasWorkspace(props: KeptTextCanvasWorkspaceProps): React.JSX.Element {
  return <KeptCanvasStudioBody {...props} initialMode="text" />
}
