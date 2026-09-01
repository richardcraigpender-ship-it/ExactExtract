import React from 'react'
import type { DocumentStyleProfile, TextStyleCluster } from '../../../shared/documentStyle'

interface StyleProfilePanelProps {
  profile?: DocumentStyleProfile
  status?: string | null
  onDetect: () => void
  onApplyBodyStyle?: (style: TextStyleCluster) => void
  onApplyHeaderStyle?: (style: TextStyleCluster) => void
  onApplyDividerStyle?: () => void
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function describeStyle(style: TextStyleCluster): string {
  return `${style.fontFamily}, ${style.fontSize} pt, ${style.fontWeight}${style.italic ? ', italic' : ''}`
}

export function StyleProfilePanel({
  profile,
  status,
  onDetect,
  onApplyBodyStyle,
  onApplyHeaderStyle,
  onApplyDividerStyle
}: StyleProfilePanelProps): React.JSX.Element {
  const bodyStyle = profile?.textStyles.find((style) => style.likelyRole === 'body')
  const headerStyle = profile?.textStyles.find((style) => style.likelyRole === 'header')
  const dividerStyle = profile?.dividerStyles[0]

  return (
    <section className="style-profile-panel" aria-label="Document style profile">
      <header>
        <div>
          <span className="eyebrow">DOCUMENT STYLE</span>
          <h3>Style profile</h3>
        </div>
        <button className="secondary-button" type="button" onClick={onDetect}>
          Detect style
        </button>
      </header>
      {status && (
        <p className="style-profile-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
      {!profile ? (
        <div className="style-profile-empty">
          <strong>No style profile yet.</strong>
          <p>Run detection for the selected source PDF to inspect reusable document styles.</p>
        </div>
      ) : (
        <>
          <dl className="style-profile-summary">
            <div>
              <dt>Confidence</dt>
              <dd>{profile.confidence}</dd>
            </div>
            <div>
              <dt>Text styles</dt>
              <dd>{profile.textStyles.length}</dd>
            </div>
            <div>
              <dt>Rules</dt>
              <dd>{profile.dividerStyles.length}</dd>
            </div>
          </dl>
          <div className="style-profile-actions" aria-label="Apply detected styles">
            <button
              className="secondary-button"
              type="button"
              disabled={!bodyStyle || !onApplyBodyStyle}
              onClick={() => bodyStyle && onApplyBodyStyle?.(bodyStyle)}
            >
              Apply body style
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!headerStyle || !onApplyHeaderStyle}
              onClick={() => headerStyle && onApplyHeaderStyle?.(headerStyle)}
            >
              Apply header style
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!dividerStyle || !onApplyDividerStyle}
              onClick={onApplyDividerStyle}
            >
              Apply divider style
            </button>
          </div>
          <ul className="style-cluster-list" aria-label="Detected text styles">
            {profile.textStyles.map((style) => (
              <li key={style.id}>
                <strong>{style.likelyRole}</strong>
                <span>{describeStyle(style)}</span>
                <small>
                  {style.occurrenceCount} uses across{' '}
                  {percent(style.pageNumbers.length / Math.max(1, profile.pageSummaries.length))} of
                  pages
                </small>
              </li>
            ))}
          </ul>
          {profile.colourPalette.length > 0 && (
            <div className="style-colour-list" aria-label="Detected colour palette">
              {profile.colourPalette.map((colour) => (
                <span key={colour.hex}>
                  <i style={{ background: colour.hex }} /> {colour.name} {colour.hex}
                </span>
              ))}
            </div>
          )}
          {profile.warnings.length > 0 && (
            <ul className="style-profile-warnings" aria-label="Style detection warnings">
              {profile.warnings.map((warning) => (
                <li key={`${warning.code}:${warning.pageNumber ?? 'all'}:${warning.message}`}>
                  {warning.message}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
