import React from 'react'
import { FileText, Keyboard, Layers, Moon, Plus, ScanSearch, Sun } from 'lucide-react'
import type { ProjectEntry } from '../../../shared/contracts'

type Screen = 'onboarding' | 'import' | 'preflight' | 'workspace'
type Theme = 'light' | 'dark'
type ExtractionMode = 'fast' | 'balanced' | 'maximum' | 'custom'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface HeaderBarProps {
  screen: Screen
  theme: Theme
  onBrandClick: () => void
  onToggleTheme: () => void
  onAddPdfs: () => void
  onToggleShortcutsHelp: () => void
  projectName?: string
  activeDocumentName?: string
  documentCount?: number
  sourcePageCount?: number
  entries?: ProjectEntry[]
  warningCount?: number
  saveStatus?: SaveStatus
  extractionMode?: ExtractionMode
}

export const HeaderBar = React.memo(function HeaderBar({
  screen,
  theme,
  onBrandClick,
  onToggleTheme,
  onAddPdfs,
  onToggleShortcutsHelp,
  projectName,
  activeDocumentName,
  documentCount,
  sourcePageCount,
  entries = [],
  warningCount = 0,
  saveStatus,
  extractionMode
}: HeaderBarProps): React.JSX.Element {
  const { keptCount, maybeCount, excludedCount } = React.useMemo(() => {
    let kept = 0
    let maybe = 0
    let excluded = 0
    for (const entry of entries) {
      if (entry.status === 'keep') kept++
      else if (entry.status === 'maybe') maybe++
      else if (entry.status === 'exclude') excluded++
    }
    return { keptCount: kept, maybeCount: maybe, excludedCount: excluded }
  }, [entries])
  const showWorkspaceStats = screen === 'workspace'

  return (
    <header className="app-header">
      <button className="brand" type="button" onClick={onBrandClick}>
        <span className="brand-mark">
          <ScanSearch size={19} />
        </span>
        <span>EXACT EXTRACT</span>
      </button>

      {showWorkspaceStats && (
        <div className="header-stats" aria-label="Project and review stats">
          {projectName && (
            <span className="header-stat header-stat-name" title={projectName}>
              {projectName}
            </span>
          )}
          {activeDocumentName && (
            <span className="header-stat" title={activeDocumentName}>
              <FileText size={13} aria-hidden="true" />
              {activeDocumentName}
            </span>
          )}
          {typeof documentCount === 'number' && (
            <span className="header-stat" title="Imported source documents">
              <Layers size={13} aria-hidden="true" />
              {documentCount} source{documentCount === 1 ? '' : 's'}
            </span>
          )}
          {typeof sourcePageCount === 'number' && (
            <span className="header-stat" title="Pages in the active source document">
              {sourcePageCount} page{sourcePageCount === 1 ? '' : 's'}
            </span>
          )}
          <span className="header-stat header-stat-counts" title="Kept / maybe / excluded entries">
            <span className="header-count header-count-keep">{keptCount} kept</span>
            <span className="header-count header-count-maybe">{maybeCount} maybe</span>
            <span className="header-count header-count-exclude">{excludedCount} excluded</span>
          </span>
          {warningCount > 0 && (
            <span className="header-stat header-stat-warning" title="Detected review warnings">
              {warningCount} warning{warningCount === 1 ? '' : 's'}
            </span>
          )}
          {extractionMode && <span className="status-pill">{extractionMode} extraction</span>}
          {saveStatus && (
            <span
              className={`save-status save-${saveStatus}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'error'
                  ? 'Save failed'
                  : saveStatus === 'saved'
                    ? 'Saved'
                    : ''}
            </span>
          )}
        </div>
      )}

      <div className="header-actions">
        {screen !== 'onboarding' && (
          <button className="secondary-button" type="button" onClick={onAddPdfs}>
            <Plus size={16} /> Add PDFs
          </button>
        )}
        <button
          className="icon-button"
          type="button"
          title="Keyboard shortcuts (?)"
          onClick={onToggleShortcutsHelp}
        >
          <Keyboard size={15} />
        </button>
        <button
          className="icon-button"
          type="button"
          title={`Use ${theme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
})

export type { HeaderBarProps }
