import React, { type ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useModalFocusTrap } from './useModalFocusTrap'

interface WorkspaceToolWindowProps {
  title: string
  children: ReactNode
  onClose: () => void
  className?: string
}

export function WorkspaceToolWindow({
  title,
  children,
  onClose,
  className
}: WorkspaceToolWindowProps): React.JSX.Element {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const { dialogRef, onKeyDown: trapFocus } = useModalFocusTrap()

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  return (
    <div
      className="workspace-tool-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className={`workspace-tool-window${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-tool-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
          else trapFocus(event)
        }}
      >
        <header>
          <h2 id="workspace-tool-title">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="workspace-tool-content">{children}</div>
      </section>
    </div>
  )
}
