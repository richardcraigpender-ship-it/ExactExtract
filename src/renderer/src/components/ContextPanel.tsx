import React, { type ReactNode } from 'react'
import type { ContextMode } from './EntryActionsStrip'

const contextLabels: Record<ContextMode, string> = {
  review: 'Review and bulk actions',
  analysis: 'Analysis',
  export: 'Export',
  pages: 'Page previewer',
  warnings: 'Warnings and duplicates',
  'remove-pages': 'Remove pages'
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
      className="right-workspace-context"
      role="tabpanel"
      aria-label={contextLabels[mode]}
    >
      {children}
    </section>
  )
})
