import React from 'react'
import { ChevronLeft, ChevronRight, FileText, Plus } from 'lucide-react'

interface SourcesRailDocument {
  path: string
  name: string
}

interface SourcesRailProps {
  documents: SourcesRailDocument[]
  activePath?: string | null
  collapsed: boolean
  onToggleCollapsed: () => void
  onSelect: (path: string) => void
  onAddPdfs: () => void
}

export const SourcesRail = React.memo(function SourcesRail({
  documents,
  activePath,
  collapsed,
  onToggleCollapsed,
  onSelect,
  onAddPdfs
}: SourcesRailProps): React.JSX.Element {
  return (
    <aside
      className={`source-rail ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Source documents"
    >
      <div className="rail-header">
        {!collapsed && <span className="rail-label">SOURCES</span>}
        <button
          className="icon-button"
          type="button"
          title={collapsed ? 'Expand sources' : 'Collapse sources'}
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
      {documents.map((document) => (
        <button
          className={activePath === document.path ? 'is-active' : ''}
          type="button"
          key={document.path}
          onClick={() => onSelect(document.path)}
          aria-pressed={activePath === document.path}
          aria-label={`${activePath === document.path ? 'Active source: ' : 'Select source '}${document.name}`}
          title={document.name}
        >
          <FileText size={18} />
          {!collapsed && <span>{document.name}</span>}
        </button>
      ))}
      <button className="rail-add-button" type="button" title="Add PDFs" onClick={onAddPdfs}>
        <Plus size={16} />
        {!collapsed && <span>Add PDFs</span>}
      </button>
    </aside>
  )
})

export type { SourcesRailProps }
