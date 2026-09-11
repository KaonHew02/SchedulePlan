import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
  const panel = useRef<HTMLDivElement>(null)
  const [floor, setFloor] = useState(0)

  /**
   * Once open, the panel only ever grows.
   *
   * It is anchored to the bottom of the screen and sized by its content, so
   * content going away moves its **top** edge down — and everything above the
   * gap with it. Turning on All day hides the two clock rows under the switch
   * and slid that switch a hundred pixels down, out from under the finger
   * that had just tapped it. A control must not move when you use it.
   *
   * So the tallest it has been becomes a floor. Rows that go away leave the
   * space they were in rather than dragging the form down over it. No
   * dependency list on purpose: this has to re-measure after any render that
   * changed the content, and `setFloor` with an unchanged value is a no-op.
   * `offsetHeight` is already clamped by max-h-[92vh], so the floor can never
   * push the panel past the bottom of the screen.
   */
  useLayoutEffect(() => {
    const height = panel.current?.offsetHeight ?? 0
    if (height > floor) setFloor(height)
  })

  // A floor measured in portrait is taller than landscape allows, and would
  // push the panel's top — and its close button — off the screen. Dropping it
  // on a resize lets the effect above take a fresh measurement at the new size.
  useEffect(() => {
    const reset = () => setFloor(0)
    window.addEventListener('resize', reset)
    return () => window.removeEventListener('resize', reset)
  }, [])

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
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={floor ? { minHeight: floor } : undefined}
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
        {/* min-h-0 is what lets this scroll inside a capped column; flex-1 is
            what makes it absorb the floor above rather than leaving a gap
            under the footer. */}
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 ${footer ? 'pb-4' : 'pb-safe-5'}`}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-neutral-100 bg-white px-5 pt-4 pb-safe-7 sm:rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
