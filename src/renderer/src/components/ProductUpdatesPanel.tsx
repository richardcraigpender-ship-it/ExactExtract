import React, { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { PRODUCT_UPDATES, type ProductUpdateKind } from '../productUpdates'
import './ProductUpdatesPanel.css'

const kindClass: Record<ProductUpdateKind, string> = {
  Feature: 'is-feature',
  Changed: 'is-changed',
  Fixed: 'is-fixed'
}

const STARTUP_UPDATE_LIMIT = 8

export function ProductUpdatesPanel(): React.JSX.Element {
  const [showAll, setShowAll] = useState(false)
  const visibleUpdates = showAll ? PRODUCT_UPDATES : PRODUCT_UPDATES.slice(0, STARTUP_UPDATE_LIMIT)
  const hasMoreUpdates = PRODUCT_UPDATES.length > STARTUP_UPDATE_LIMIT

  return (
    <aside className="product-updates" aria-labelledby="product-updates-title">
      <header>
        <div>
          <span>LATEST ACTIVITY</span>
          <h2 id="product-updates-title">What’s new</h2>
        </div>
        <ArrowUpRight size={18} aria-hidden="true" />
      </header>
      <ol id="product-updates-list" className="product-updates-list">
        {visibleUpdates.map((update) => (
          <li key={`${update.date}-${update.title}`}>
            <div className="product-update-meta">
              <time dateTime={update.date}>
                {new Date(`${update.date}T00:00:00`).toLocaleDateString(undefined, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </time>
              <span className={kindClass[update.kind]}>{update.kind}</span>
            </div>
            <strong>{update.title}</strong>
            <p>{update.summary}</p>
          </li>
        ))}
      </ol>
      {hasMoreUpdates && (
        <button
          className="product-updates-toggle"
          type="button"
          aria-controls="product-updates-list"
          aria-expanded={showAll}
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? 'Show latest' : `View all ${PRODUCT_UPDATES.length} updates`}
        </button>
      )}
    </aside>
  )
}
