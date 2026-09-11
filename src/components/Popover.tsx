import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/**
 * A panel pinned under the thing that opened it.
 *
 * It renders into a portal rather than next to its trigger, for one stubborn
 * reason: the add form lives in a bottom sheet whose body scrolls, and
 * anything positioned inside a scrolling box gets clipped by it. A calendar
 * that loses its bottom two rows is worse than no calendar.
 *
 * Being outside the sheet means the position has to be worked out by hand and
 * redone whenever anything moves, which is what the layout effect below does.
 */

const MARGIN = 8
const GAP = 6

interface Props {
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  label: string
}

export default function Popover({ anchor, onClose, children, label }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    function place() {
      const trigger = anchor.current
      const box = panel.current
      if (!trigger || !box) return

      const rect = trigger.getBoundingClientRect()
      const width = box.offsetWidth
      const height = box.offsetHeight
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Right edges line up: these triggers sit at the right of their row, so
      // hanging the panel leftward from them is what keeps it on screen.
      let left = rect.right - width
      left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, viewportWidth - width - MARGIN))

      // Below by preference, above when below would run off — and when
      // neither fits, take whichever side has more room and let it scroll.
      const below = rect.bottom + GAP
      const above = rect.top - height - GAP
      let top: number
      if (below + height <= viewportHeight - MARGIN) top = below
      else if (above >= MARGIN) top = above
      else top = Math.max(MARGIN, viewportHeight - height - MARGIN)

      setPosition({ top, left })
    }

    place()
    // Capture phase: the sheet's own scroll container never bubbles to window.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchor])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation() // or the sheet behind it closes too
        onClose()
      }
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    // Pointerdown, not click: a click that started inside and ended outside
    // (a drag across the calendar) should not count as dismissing it.
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        // Measured on the first pass, shown on the second. Rendering it at
        // 0,0 for one frame and then snapping into place reads as a glitch.
        visibility: position ? 'visible' : 'hidden',
      }}
      className="fixed z-[60] rounded-2xl border border-neutral-200 bg-white shadow-xl animate-pop-in"
    >
      {children}
    </div>,
    document.body,
  )
}
