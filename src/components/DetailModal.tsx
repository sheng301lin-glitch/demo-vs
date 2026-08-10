import { useEffect, useId, type ReactNode } from 'react'

export interface DetailModalProps {
  open: boolean
  title: string
  onClose: () => void
  size?: 'task' | 'content'
  children: ReactNode
}

export function DetailModal({ open, title, onClose, size = 'task', children }: DetailModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="detail-modal-backdrop"
      data-testid="detail-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className={`detail-modal detail-modal--${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="detail-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" aria-label={`关闭${title}`} onClick={onClose}>×</button>
        </header>
        <div className="detail-modal-body">{children}</div>
      </section>
    </div>
  )
}
