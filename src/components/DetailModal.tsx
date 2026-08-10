import { useEffect, useId, useRef, type ReactNode } from 'react'

export interface DetailModalProps {
  open: boolean
  title: string
  onClose: () => void
  size?: 'task' | 'content'
  children: ReactNode
}

export function DetailModal({ open, title, onClose, size = 'task', children }: DetailModalProps) {
  const titleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key !== 'Tab') return

      const focusable = Array.from(modalRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []).filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) {
        event.preventDefault()
        modalRef.current?.focus()
      } else if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
        event.preventDefault()
        const nextFocus = event.shiftKey ? last : first
        nextFocus.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnKeyDown)
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnKeyDown)
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="detail-modal-backdrop"
      data-testid="detail-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onCloseRef.current()}
    >
      <section ref={modalRef} className={`detail-modal detail-modal--${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="detail-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeButtonRef} className="icon-button" aria-label={`关闭${title}`} onClick={() => onCloseRef.current()}>×</button>
        </header>
        <div className="detail-modal-body">{children}</div>
      </section>
    </div>
  )
}
