import React, { type ReactNode } from 'react'
import { ContextPanel } from './ContextPanel'
import { EntryActionsStrip, type ContextMode, type EntryActionCommand } from './EntryActionsStrip'

export type RightWorkspaceMode = ContextMode
export type RightWorkspaceCommand = EntryActionCommand

interface RightWorkspaceProps {
  mode: RightWorkspaceMode
  entries: ReactNode
  contexts: Record<RightWorkspaceMode, ReactNode>
  onModeChange: (mode: RightWorkspaceMode) => void
  onCommand: (command: RightWorkspaceCommand) => void
  warningCount?: number
  highlightsVisible?: boolean
}

export const RightWorkspace = React.memo(function RightWorkspace({
  mode,
  entries,
  contexts,
  onModeChange,
  onCommand,
  warningCount = 0,
  highlightsVisible = true
}: RightWorkspaceProps): React.JSX.Element {
  return (
    <aside className="right-workspace" aria-label="Entries and workspace tools">
      <section className="right-workspace-entries" aria-label="Extracted entries">
        {entries}
      </section>
      <EntryActionsStrip
        mode={mode}
        warningCount={warningCount}
        highlightsVisible={highlightsVisible}
        onModeChange={onModeChange}
        onCommand={onCommand}
      />
      <ContextPanel mode={mode}>{contexts[mode]}</ContextPanel>
    </aside>
  )
})
