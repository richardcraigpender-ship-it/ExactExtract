import React, { type ReactNode } from 'react'
import { ContextPanel } from './ContextPanel'
import { EntryActionsStrip, type ContextMode, type EntryActionCommand } from './EntryActionsStrip'

export type RightWorkspaceMode = ContextMode
export type RightWorkspaceCommand = EntryActionCommand

interface RightWorkspaceProps {
  mode: RightWorkspaceMode
  entries: ReactNode
  reviewControls: ReactNode
  contexts: Record<RightWorkspaceMode, ReactNode>
  onModeChange: (mode: RightWorkspaceMode) => void
  onCommand: (command: RightWorkspaceCommand) => void
  warningCount?: number
  highlightsVisible?: boolean
}

export const RightWorkspace = React.memo(function RightWorkspace({
  mode,
  entries,
  reviewControls,
  contexts,
  onModeChange,
  onCommand,
  warningCount = 0,
  highlightsVisible = true
}: RightWorkspaceProps): React.JSX.Element {
  return (
    <>
      <aside className="left-workspace" aria-label="Workspace tools">
        {mode !== 'review' && (
          <section className="persistent-review-controls" aria-label="Review controls">
            {reviewControls}
          </section>
        )}
        <ContextPanel mode={mode}>
          {mode === 'review' ? reviewControls : contexts[mode]}
        </ContextPanel>
      </aside>
      <EntryActionsStrip
        mode={mode}
        warningCount={warningCount}
        highlightsVisible={highlightsVisible}
        onModeChange={onModeChange}
        onCommand={onCommand}
      />
      <aside className="right-workspace" aria-label="Extracted entries">
        {entries}
      </aside>
    </>
  )
})
