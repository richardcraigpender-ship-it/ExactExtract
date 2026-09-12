import React from 'react'
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileSearch,
  FileText,
  Fingerprint,
  Images,
  Link,
  Save,
  Store,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut
} from 'lucide-react'

export type ContextMode =
  | 'source-pdf'
  | 'review'
  | 'analysis'
  | 'export'
  | 'style'
  | 'pages'
  | 'warnings'
  | 'remove-pages'
  | 'marks'
  | 'references'
  | 'merchants'
  | 'report'
export type EntryActionCommand =
  'zoom-in' | 'zoom-out' | 'import' | 'save' | 'jump' | 'currency' | 'detect-style'

const contextModes = [
  { id: 'source-pdf', label: 'Source PDF', shortLabel: 'Source', icon: FileText },
  { id: 'report', label: 'Extraction report', shortLabel: 'Report', icon: ClipboardList },
  { id: 'analysis', label: 'Analysis', shortLabel: 'Stats', icon: BarChart3 },
  { id: 'export', label: 'Export', shortLabel: 'Export', icon: Download },
  { id: 'style', label: 'Document style profile', shortLabel: 'Style', icon: Fingerprint },
  { id: 'pages', label: 'Page previewer', shortLabel: 'Pages', icon: Images },
  { id: 'warnings', label: 'Warnings and duplicates', shortLabel: 'Issues', icon: AlertTriangle },
  { id: 'remove-pages', label: 'Remove pages', shortLabel: 'Remove', icon: Trash2 },
  { id: 'marks', label: 'Highlight tools', shortLabel: 'Marks', icon: Eye },
  { id: 'references', label: 'Reference tools', shortLabel: 'Refs', icon: Link },
  { id: 'merchants', label: 'Merchant library', shortLabel: 'Shops', icon: Store }
] as const

const commands = [
  { id: 'zoom-out', label: 'Zoom out', shortLabel: 'Zoom -', icon: ZoomOut },
  { id: 'zoom-in', label: 'Zoom in', shortLabel: 'Zoom +', icon: ZoomIn },
  { id: 'import', label: 'Add PDFs', shortLabel: 'Add', icon: Upload },
  { id: 'save', label: 'Save project', shortLabel: 'Save', icon: Save },
  { id: 'jump', label: 'Jump to page', shortLabel: 'Jump', icon: FileSearch },
  { id: 'detect-style', label: 'Detect style', shortLabel: 'Style', icon: Fingerprint },
  { id: 'currency', label: 'Project currency', shortLabel: '$/£', icon: null }
] as const

interface EntryActionsStripProps {
  mode: ContextMode
  onModeChange: (mode: ContextMode) => void
  onCommand: (command: EntryActionCommand) => void
  warningCount?: number
  highlightsVisible?: boolean
}

export const EntryActionsStrip = React.memo(function EntryActionsStrip({
  mode,
  onModeChange,
  onCommand,
  warningCount = 0,
  highlightsVisible = true
}: EntryActionsStripProps): React.JSX.Element {
  return (
    <nav className="workspace-tool-strip" aria-label="Workspace tools">
      <div className="right-workspace-commands" aria-label="Quick commands">
        {commands.map(({ id, label, shortLabel, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            title={label}
            onClick={(event) => {
              event.stopPropagation()
              onCommand(id)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation()
              }
            }}
          >
            {Icon ? (
              <Icon size={17} aria-hidden="true" />
            ) : (
              <span className="currency-tool-symbol" aria-hidden="true">
                $/£
              </span>
            )}
            <span className="right-workspace-tool-label" aria-hidden="true">
              {shortLabel}
            </span>
          </button>
        ))}
      </div>
      <div role="tablist" aria-label="Context panel">
        {contextModes.map(({ id, label, shortLabel, icon: Icon }) => {
          const isMarks = id === 'marks'
          const TabIcon = isMarks && !highlightsVisible ? EyeOff : Icon
          const tabLabel = isMarks && !highlightsVisible ? `${label} (highlights hidden)` : label
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-label={tabLabel}
              aria-selected={mode === id}
              aria-controls={`right-workspace-context-${id}`}
              title={tabLabel}
              onClick={(event) => {
                event.stopPropagation()
                onModeChange(id)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.stopPropagation()
                }
              }}
            >
              <TabIcon size={17} aria-hidden="true" />
              <span className="right-workspace-tool-label" aria-hidden="true">
                {shortLabel}
              </span>
              {id === 'warnings' && warningCount > 0 && (
                <span
                  className="right-workspace-command-count"
                  aria-label={`${warningCount} warnings`}
                >
                  {warningCount > 99 ? '99+' : warningCount}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
})
