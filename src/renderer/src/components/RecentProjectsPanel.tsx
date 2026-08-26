import React, { useState } from 'react'
import { AlertTriangle, FileQuestion, FolderOpen, LocateFixed, Trash2 } from 'lucide-react'
import {
  sortRecentProjects,
  type RecentProjectRecoveryItem,
  type SaveRecoveryState
} from '../../../recovery'
import './RecentProjectsPanel.css'
import { WorkspaceToolWindow } from './WorkspaceToolWindow'

interface RecentProjectsPanelProps {
  projects: readonly RecentProjectRecoveryItem[]
  saveState: SaveRecoveryState
  recoveryStatus: string | null
  onOpen: (projectId: string) => void
  onRemove: (projectId: string) => void
  onLocateSources: (projectId: string) => void
  onRetrySave: () => void
}

export function RecentProjectsPanel({
  projects,
  saveState,
  recoveryStatus,
  onOpen,
  onRemove,
  onLocateSources,
  onRetrySave
}: RecentProjectsPanelProps): React.JSX.Element {
  const sorted = sortRecentProjects(projects)
  const visibleProjects = sorted.slice(0, 5)
  const [showAll, setShowAll] = useState(false)
  const renderProjects = (items: typeof sorted): React.JSX.Element => (
    <div className="recent-project-list">
      {items.map((project) => (
        <article key={project.id}>
          <button
            className="recent-project-open"
            type="button"
            onClick={() => onOpen(project.id)}
            disabled={project.availability === 'missing'}
          >
            <FolderOpen size={17} />
            <span>
              <strong>{project.name}</strong>
              <small>{new Date(project.updatedAt).toLocaleString()}</small>
            </span>
          </button>
          {project.availability === 'missing' && (
            <span className="recent-missing">
              <AlertTriangle size={14} /> {project.missingSourceCount} missing source
              {project.missingSourceCount === 1 ? '' : 's'}
            </span>
          )}
          <div className="recent-project-actions">
            {project.availability === 'missing' && (
              <button
                type="button"
                title="Locate missing source files"
                onClick={() => onLocateSources(project.id)}
              >
                <LocateFixed size={16} />
              </button>
            )}
            <button
              type="button"
              title="Remove from recent projects"
              onClick={() => onRemove(project.id)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </article>
      ))}
    </div>
  )
  return (
    <section className="recent-projects-panel" aria-label="Recent projects">
      <header>
        <div>
          <span>RECENT PROJECTS</span>
          <h2>Continue your work</h2>
        </div>
        <div className="recent-project-header-actions">
          <strong>
            {sorted.length === 0 ? '0 projects' : `${Math.min(sorted.length, 5)} shown`}
          </strong>
          {sorted.length > 5 && (
            <button type="button" onClick={() => setShowAll(true)}>
              View all {sorted.length}
            </button>
          )}
        </div>
      </header>
      {saveState.status === 'error' && (
        <div className="recent-save-error" role="alert">
          <AlertTriangle size={17} />
          <span>
            <strong>Autosave failed</strong>
            <small>{saveState.message}</small>
          </span>
          <button type="button" onClick={onRetrySave}>
            Retry save
          </button>
        </div>
      )}
      {recoveryStatus && (
        <p className="recent-recovery-status" role="status" aria-live="polite">
          {recoveryStatus}
        </p>
      )}
      {sorted.length === 0 ? (
        <div className="recent-empty">
          <FileQuestion size={30} />
          <strong>No recent projects</strong>
          <span>Create a project to begin reviewing PDFs.</span>
        </div>
      ) : (
        renderProjects(visibleProjects)
      )}
      {showAll && (
        <WorkspaceToolWindow title="All recent projects" onClose={() => setShowAll(false)}>
          <div className="recent-projects-all">{renderProjects(sorted)}</div>
        </WorkspaceToolWindow>
      )}
    </section>
  )
}
