import React, { type ReactNode } from 'react'
import type { ContextMode } from './EntryActionsStrip'

const contextLabels: Record<ContextMode, string> = {
  'source-pdf': 'Source PDF',
  review: 'Review and bulk actions',
  analysis: 'Analysis',
  export: 'Export',
  pages: 'Page previewer',
  warnings: 'Warnings and duplicates',
  'remove-pages': 'Remove pages',
  marks: 'Highlight tools'
}

interface ContextPanelProps {
  mode: ContextMode
  children: ReactNode
}

export const ContextPanel = React.memo(function ContextPanel({
  mode,
  children
}: ContextPanelProps): React.JSX.Element {
  return (
    <section
      id={`right-workspace-context-${mode}`}
      className="workspace-context"
      role="tabpanel"
      aria-label={contextLabels[mode]}
    >
      {children}
    </section>
  )
})
