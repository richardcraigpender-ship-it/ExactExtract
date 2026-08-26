import React from 'react'
import type { ProjectEntry } from '../../../shared/contracts'
import type { KeptEntryPlacement } from '../../../shared/keptEntriesLayout'

interface SourceMetadataPanelProps {
  entries: readonly ProjectEntry[]
  placements: readonly KeptEntryPlacement[]
}

export function SourceMetadataPanel({
  entries,
  placements
}: SourceMetadataPanelProps): React.JSX.Element {
  const keptEntries = entries.filter((entry) => entry.status === 'keep')
  const boundPlacements = placements.filter((placement) => placement.entryId)
  const sourcePages = new Set(
    keptEntries.flatMap((entry) =>
      entry.regions.map((region) => `${region.documentId} p.${region.pageNumber}`)
    )
  )
  const systemFonts = new Set(
    placements
      .filter((placement) => placement.fontRef.kind === 'system')
      .map((placement) => placement.fontRef.family)
  )

  return (
    <section className="source-metadata-panel" aria-labelledby="source-metadata-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">SOURCE TRACEABILITY</span>
          <strong id="source-metadata-title">Original source metadata</strong>
        </div>
      </div>
      <dl className="source-metadata-summary">
        <div>
          <dt>Kept entries</dt>
          <dd>{keptEntries.length}</dd>
        </div>
        <div>
          <dt>Placed entries</dt>
          <dd>{boundPlacements.length}</dd>
        </div>
        <div>
          <dt>Source regions</dt>
          <dd>{sourcePages.size}</dd>
        </div>
        <div>
          <dt>System fonts</dt>
          <dd>{systemFonts.size}</dd>
        </div>
      </dl>
      <p className="context-help">
        Source regions remain attached to each kept entry. Placement changes affect the preview
        layout only, not extraction evidence.
      </p>
      {systemFonts.size > 0 && (
        <p className="source-metadata-fonts">Fonts in use: {[...systemFonts].sort().join(', ')}</p>
      )}
    </section>
  )
}
