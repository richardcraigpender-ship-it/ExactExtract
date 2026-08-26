import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface FloatingPanelProps {
  title: string
  eyebrow?: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  labelledBy?: string
}

export function FloatingPanel({
  title,
  eyebrow,
  children,
  onClose,
  footer,
  labelledBy
}: FloatingPanelProps): React.JSX.Element {
  const titleId =
    labelledBy ?? `floating-panel-${title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <aside className="floating-panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="floating-panel-header">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <strong id={titleId}>{title}</strong>
        </div>
        <button className="icon-button" type="button" title={`Close ${title}`} onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="floating-panel-body">{children}</div>
      {footer && <footer className="floating-panel-footer">{footer}</footer>}
    </aside>
  )
}
