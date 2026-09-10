import { useEffect, type ReactNode } from 'react'
import { Close } from './Icons'

interface Props {
  onClose: () => void
  title: string
  children: ReactNode
  /** Pinned below the scroll area, so the primary action never scrolls away. */
  footer?: ReactNode
}

/** A bottom sheet: the app's one modal pattern. Mounted only while open. */
export default function Sheet({ onClose, title, children, footer }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-neutral-900/25 animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:max-w-md max-h-[92vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-xl animate-sheet-up"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -mr-1.5 rounded-full text-neutral-400 hover:bg-neutral-100 active:bg-neutral-100"
          >
            <Close />
          </button>
        </div>
        <div className={`overflow-y-auto px-5 ${footer ? 'pb-4' : 'pb-safe-5'}`}>{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-neutral-100 bg-white px-5 pt-4 pb-safe-7 sm:rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
