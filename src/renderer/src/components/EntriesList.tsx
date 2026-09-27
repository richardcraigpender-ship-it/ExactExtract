import type { ProjectEntry, ReviewStatus } from '../../../shared/contracts'
import { ArrowUp, Check, CircleHelp, Link, MoreHorizontal, Plus, X } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { hasNestedInteractiveTarget } from './entryRowInteraction'

const DEFAULT_ROW_HEIGHT = 54

interface EntriesListProps {
  entries: readonly ProjectEntry[]
  selectedEntryId: string | null
  selectedEntryIds: ReadonlySet<string>
  issuesByEntry?: ReadonlyMap<string, readonly { id: string; code: string }[]>
  onSelect: (entryId: string) => void
  onToggleSelection: (entryId: string) => void
  onSetStatus?: (entryId: string, status: ReviewStatus) => void
  onEdit?: (entryId: string) => void
  onOpenReferences?: (entryId: string) => void
  onMergeUp?: (entryId: string) => void
  canMergeUp?: (entryId: string) => boolean
  pageForEntry?: (entry: ProjectEntry) => number | undefined
  onPageJump?: (pageNumber: number) => void
  viewportHeight?: number
  rowHeight?: number
  overscan?: number
}

export const EntriesList = React.memo(function EntriesList({
  entries,
  selectedEntryId,
  selectedEntryIds,
  issuesByEntry,
  onSelect,
  onToggleSelection,
  onSetStatus,
  onEdit,
  onOpenReferences,
  onMergeUp,
  canMergeUp = () => false,
  pageForEntry,
  onPageJump,
  viewportHeight,
  rowHeight = DEFAULT_ROW_HEIGHT,
  overscan = 5
}: EntriesListProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [measuredViewportHeight, setMeasuredViewportHeight] = useState<number>(400)
  const [openOverflowEntryId, setOpenOverflowEntryId] = useState<string | null>(null)

  useEffect(() => {
    if (!openOverflowEntryId) return

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest('.decision-overflow')) {
        setOpenOverflowEntryId(null)
      }
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenOverflowEntryId(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openOverflowEntryId])

  useEffect(() => {
    if (viewportHeight) return

    const listNode = listRef.current
    if (!listNode) return

    const syncSize = (): void => {
      setMeasuredViewportHeight(Math.max(listNode.clientHeight || rowHeight, rowHeight))
    }

    syncSize()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(syncSize)
    observer.observe(listNode)
    return () => observer.disconnect()
  }, [rowHeight, viewportHeight])

  const effectiveViewportHeight = viewportHeight ?? measuredViewportHeight

  const visibleRange = useMemo(() => {
    const contentHeight = Math.max(entries.length * rowHeight, 0)
    const viewport = effectiveViewportHeight > 0 ? effectiveViewportHeight : contentHeight
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    const endIndex = Math.min(
      entries.length,
      Math.ceil((scrollTop + viewport) / rowHeight) + overscan
    )
    return { startIndex, endIndex }
  }, [effectiveViewportHeight, entries.length, overscan, rowHeight, scrollTop])

  const visibleEntries = entries.slice(visibleRange.startIndex, visibleRange.endIndex)
  const totalHeight = entries.length * rowHeight

  return (
    <div
      ref={listRef}
      className="entry-list"
      aria-label="Extracted entries"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      style={
        viewportHeight
          ? {
              maxHeight: `${Math.max(viewportHeight, rowHeight)}px`,
              overflowY: 'auto',
              contain: 'content'
            }
          : {
              overflowY: 'auto',
              contain: 'content'
            }
      }
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        {visibleEntries.map((entry, index) => {
          const entryNumber = visibleRange.startIndex + index + 1
          const pageNumber = pageForEntry?.(entry) ?? entry.regions[0]?.pageNumber
          const issues = issuesByEntry?.get(entry.id) ?? []
          const mergeEnabled = Boolean(onMergeUp && canMergeUp(entry.id))
          const rowOffset = (visibleRange.startIndex + index) * rowHeight

          return (
            <div
              key={entry.id}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${rowOffset}px`,
                height: `${rowHeight}px`
              }}
            >
              <article className={`entry-row ${selectedEntryId === entry.id ? 'is-selected' : ''}`}>
                <span
                  className={`entry-number entry-status-${entry.status}`}
                  aria-label={`Entry ${entryNumber}, ${entry.status}`}
                >
                  <span aria-hidden="true">{entryNumber}</span>
                  <span className="sr-only">{entry.status}</span>
                </span>
                <label
                  className="entry-check"
                  title={`Select entry ${entryNumber}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedEntryIds.has(entry.id)}
                    onChange={() => onToggleSelection(entry.id)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <span className="sr-only">Select entry {entryNumber}</span>
                </label>
                <div
                  className="entry-select"
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedEntryId === entry.id}
                  onClick={(event) => {
                    if (
                      event.defaultPrevented ||
                      hasNestedInteractiveTarget(event.target, event.currentTarget)
                    ) {
                      return
                    }
                    onSelect(entry.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.defaultPrevented) return
                    if (hasNestedInteractiveTarget(event.target, event.currentTarget)) {
                      return
                    }
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      event.stopPropagation()
                      onSelect(entry.id)
                    }
                  }}
                >
                  <span className="entry-metadata">
                    {pageNumber && onPageJump ? (
                      <button
                        className="entry-page-jump"
                        type="button"
                        title={`Jump to source page ${pageNumber}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onPageJump(pageNumber)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            event.stopPropagation()
                          }
                        }}
                      >
                        Page {pageNumber}
                      </button>
                    ) : (
                      <span>Page {pageNumber ?? '?'}</span>
                    )}
                    <span>{entry.category ?? 'text'}</span>
                    {issues.length > 0 && (
                      <span className="entry-warnings">
                        {issues.map((issue) => (
                          <span key={issue.id}>{issue.code}</span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="entry-confidence">{Math.round(entry.confidence * 100)}%</span>
                </div>
                <div
                  className="entry-decisions"
                  aria-label={`Decision for entry ${entryNumber}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    className="decision-keep"
                    type="button"
                    aria-pressed={entry.status === 'keep'}
                    title={`Keep entry ${entryNumber}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSetStatus?.(entry.id, 'keep')
                    }}
                  >
                    <Check size={14} aria-hidden="true" />
                    <span className="sr-only">Keep entry {entryNumber}</span>
                  </button>
                  <button
                    className="decision-maybe"
                    type="button"
                    aria-pressed={entry.status === 'maybe'}
                    title={`Mark entry ${entryNumber} maybe`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSetStatus?.(entry.id, 'maybe')
                    }}
                  >
                    <CircleHelp size={14} aria-hidden="true" />
                    <span className="sr-only">Mark entry {entryNumber} maybe</span>
                  </button>
                  <button
                    className="decision-exclude"
                    type="button"
                    aria-pressed={entry.status === 'exclude'}
                    title={`Exclude entry ${entryNumber}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSetStatus?.(entry.id, 'exclude')
                    }}
                  >
                    <X size={14} aria-hidden="true" />
                    <span className="sr-only">Exclude entry {entryNumber}</span>
                  </button>
                  {onMergeUp && (
                    <button
                      className="decision-merge-up"
                      type="button"
                      title="Merge with row above"
                      disabled={!mergeEnabled}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (mergeEnabled) onMergeUp(entry.id)
                      }}
                    >
                      <ArrowUp size={14} aria-hidden="true" />
                      <span className="sr-only">Merge entry {entryNumber} with row above</span>
                    </button>
                  )}
                  <button
                    className="decision-edit"
                    type="button"
                    title={`Adjust metadata for entry ${entryNumber}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onEdit?.(entry.id)
                    }}
                  >
                    <Plus size={14} aria-hidden="true" />
                    <span className="sr-only">Adjust metadata for entry {entryNumber}</span>
                  </button>
                  {onOpenReferences && (
                    <button
                      className="decision-references"
                      type="button"
                      title={`Open reference tools for entry ${entryNumber}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenReferences(entry.id)
                      }}
                    >
                      <Link size={14} aria-hidden="true" />
                      <span className="sr-only">Open reference tools for entry {entryNumber}</span>
                    </button>
                  )}
                  {(onMergeUp || onOpenReferences) && (
                    <div
                      className={`decision-overflow ${
                        openOverflowEntryId === entry.id ? 'is-open' : ''
                      }`}
                    >
                      <button
                        className="decision-overflow-toggle"
                        type="button"
                        title="More review actions"
                        aria-label="More review actions"
                        aria-expanded={openOverflowEntryId === entry.id}
                        onClick={() =>
                          setOpenOverflowEntryId((current) =>
                            current === entry.id ? null : entry.id
                          )
                        }
                      >
                        <MoreHorizontal size={14} aria-hidden="true" />
                      </button>
                      {openOverflowEntryId === entry.id && (
                        <div
                          className="decision-overflow-menu"
                          role="menu"
                          aria-label="More review actions"
                        >
                          <button
                            className="decision-overflow-close"
                            type="button"
                            role="menuitem"
                            onClick={() => setOpenOverflowEntryId(null)}
                          >
                            <X size={14} aria-hidden="true" /> Close
                          </button>
                          {onMergeUp && (
                            <button
                              type="button"
                              role="menuitem"
                              disabled={!mergeEnabled}
                              onClick={(event) => {
                                event.stopPropagation()
                                if (mergeEnabled) {
                                  onMergeUp(entry.id)
                                  setOpenOverflowEntryId(null)
                                }
                              }}
                            >
                              <ArrowUp size={14} aria-hidden="true" /> Merge above
                            </button>
                          )}
                          {onOpenReferences && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation()
                                onOpenReferences(entry.id)
                                setOpenOverflowEntryId(null)
                              }}
                            >
                              <Link size={14} aria-hidden="true" /> References
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            </div>
          )
        })}
      </div>
    </div>
  )
})
