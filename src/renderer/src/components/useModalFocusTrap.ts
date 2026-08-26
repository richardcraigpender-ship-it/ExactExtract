import { type KeyboardEvent, type RefObject, useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

function focusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true'
  )
}

export function useModalFocusTrap<T extends HTMLElement = HTMLElement>(): {
  dialogRef: RefObject<T | null>
  onKeyDown: (event: KeyboardEvent<T>) => void
} {
  const dialogRef = useRef<T>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const firstFocusable = dialog && focusableElements(dialog)[0]
    firstFocusable?.focus()

    return () => {
      openerRef.current?.focus()
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<T>): void => {
    if (event.key !== 'Tab') return
    const dialog = dialogRef.current
    if (!dialog) return
    const elements = focusableElements(dialog)
    if (elements.length === 0) {
      event.preventDefault()
      return
    }
    const first = elements[0]!
    const last = elements.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return { dialogRef, onKeyDown }
}
