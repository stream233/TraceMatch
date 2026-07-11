import { X } from 'lucide-react'
import type { PropsWithChildren, ReactNode } from 'react'

interface ModalProps extends PropsWithChildren {
  title: string
  description?: string
  onClose(): void
  footer?: ReactNode
  width?: 'small' | 'medium' | 'large'
  dismissible?: boolean
}

export function Modal({ title, description, onClose, footer, width = 'medium', dismissible = true, children }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => dismissible && event.target === event.currentTarget && onClose()}>
      <section className={`modal modal--${width}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__header">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          {dismissible ? <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><X size={18} /></button> : null}
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
