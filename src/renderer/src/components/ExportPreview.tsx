import React from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { ExportSnapshot } from '../../../export'

interface ExportPreviewProps {
  snapshot: ExportSnapshot
  selectedEntryId?: string | null
  onSelectEntry?: (entryId: string) => void
}

export function ExportPreview({
  snapshot,
  selectedEntryId,
  onSelectEntry
}: ExportPreviewProps): React.JSX.Element {
  return (
    <section className="export-preview" aria-labelledby="export-preview-title">
      <header>
        <span className="eyebrow">EXPORT PREVIEW</span>
        <h2 id="export-preview-title">{snapshot.project.name}</h2>
      </header>
      <dl>
        <div>
          <dt>Sources</dt>
          <dd>{snapshot.summary.documentCount}</dd>
        </div>
        <div>
          <dt>Kept</dt>
          <dd>{snapshot.summary.keptCount}</dd>
        </div>
        <div>
          <dt>Needs review</dt>
          <dd>{snapshot.summary.maybeCount}</dd>
        </div>
      </dl>
      <div aria-label="Kept entry preview">
        {snapshot.sections.kept.slice(0, 5).map((entry) => (
          <article
            key={entry.id}
            className={`export-preview-entry ${selectedEntryId === entry.id ? 'is-selected' : ''}`}
          >
            <div className="export-preview-entry-head">
              <strong>{entry.category ?? 'Entry'}</strong>
              {onSelectEntry && (
                <button
                  type="button"
                  className="export-preview-jump"
                  title="Jump to this entry in the review queue"
                  aria-label={`Jump to "${entry.normalizedText}" in the review queue`}
                  aria-pressed={selectedEntryId === entry.id}
                  onClick={() => onSelectEntry(entry.id)}
                >
                  <ArrowUpRight size={13} aria-hidden="true" />
                </button>
              )}
            </div>
            <p>{entry.normalizedText}</p>
            <small>
              {entry.regions.length} source {entry.regions.length === 1 ? 'region' : 'regions'}
            </small>
          </article>
        ))}
      </div>
    </section>
  )
}
