import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { Close } from './Icons'
import { tr } from '../lib/i18n'

/** How far a sheet has to be pulled down, in pixels, before letting go closes it. */
const DISMISS = 90

/** The screen this much shorter than the page is a keyboard, not a toolbar. */
const KEYBOARD = 120

/** The gap left around a field brought back into view. */
const CLEARANCE = 12

/** How long to keep looking, in ms, after something that could have moved the page. */
const SETTLE = 600

/** The strip of the page a keyboard leaves showing. */
interface Room {
  top: number
  height: number
}

function keyboardRoom(): Room | null {
  const view = window.visualViewport
  if (!view) return null
  const page = Math.max(window.innerHeight, document.documentElement.clientHeight)
  // Pinched in, the view is small because it is zoomed, not because it is covered.
  if (view.scale > 1.05 || page - view.height < KEYBOARD) return null
  return { top: Math.round(view.offsetTop), height: Math.round(view.height) }
}

/**
 * Where a sheet has to fit while the keyboard is up, and null while it is not.
 *
 * A phone's keyboard does not make the page shorter. It covers the page, and
 * the browser slides the page up behind the glass to show the field being
 * typed in. `fixed` goes by the page, not by what can be seen, so a sheet
 * slides up with it and its top goes off the screen, out of reach.
 *
 * Fitting the sheet to the strip that is left works whatever the browser
 * chose to do, because `offsetTop` says how far it slid. With no keyboard this
 * is null and the sheet is laid out by its classes alone.
 */
function useKeyboardRoom() {
  const [room, setRoom] = useState(keyboardRoom)

  useEffect(() => {
    const view = window.visualViewport
    if (!view) return
    const measure = () => {
      const next = keyboardRoom()
      // At once, not on the next tick: a Popover open on this sheet hears the
      // same event straight after, and has to measure the sheet as it now is.
      flushSync(() =>
        setRoom((now) => (now?.top === next?.top && now?.height === next?.height ? now : next)),
      )
    }

    // A phone can report a slide before it has finished it, and say nothing
    // when it ends. So after anything that could move the page — the focus
    // changing, a letter typed — keep looking for a moment. It is what keeps
    // the sheet on the field while it is being typed in.
    let frame = 0
    let until = 0
    const look = () => {
      measure()
      frame = performance.now() < until ? requestAnimationFrame(look) : 0
    }
    // A frame later, not now: autoFocus fires focusin in the middle of a React
    // commit, and flushSync cannot run in there.
    const settle = () => {
      until = performance.now() + SETTLE
      if (!frame) frame = requestAnimationFrame(look)
    }
    const moved = () => {
      measure()
      settle()
    }

    view.addEventListener('resize', moved)
    view.addEventListener('scroll', moved)
    document.addEventListener('focusin', settle)
    document.addEventListener('focusout', settle)
    document.addEventListener('input', settle)
    settle()
    return () => {
      cancelAnimationFrame(frame)
      view.removeEventListener('resize', moved)
      view.removeEventListener('scroll', moved)
      document.removeEventListener('focusin', settle)
      document.removeEventListener('focusout', settle)
      document.removeEventListener('input', settle)
    }
  }, [])

  return room
}

interface Props {
  onClose: () => void
  title: string
  children: ReactNode
  /** Pinned below the scroll area, so the primary action never scrolls away. */
  footer?: ReactNode
  /** A menu's heading, set large like a screen's, rather than a form's. */
  large?: boolean
}

/** A bottom sheet: the app's one modal pattern. Mounted only while open. */
export default function Sheet({ onClose, title, children, footer, large = false }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [floor, setFloor] = useState(0)
  const room = useKeyboardRoom()

  /**
   * How it arrives: slid up from below the screen, unless a field in it has
   * the focus already. autoFocus has run by the time this does.
   *
   * A field has to be where it will stay when it takes the focus. An iPhone
   * slides the page to bring the field above the keyboard, going by where the
   * field is then, and a title still below the screen on its way up made it
   * slide the page as far as it would go. The title then rose into place above
   * the top of the screen, with the keyboard up and nothing to type into.
   *
   * So a sheet with a field in use only rises a little. A fade would not do:
   * an iPhone hides the caret of a field it sees as transparent. Set before the
   * first paint, so neither way ever shows the sheet standing still first.
   */
  const [arrival, setArrival] = useState('')
  useLayoutEffect(() => {
    const typing = panel.current?.contains(document.activeElement)
    setArrival(typing ? 'animate-sheet-rise' : 'animate-sheet-up')
  }, [])

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
   * push the panel past the bottom of the screen. A keyboard is the exception:
   * it takes the room after the floor was measured, so the floor gives way to
   * it below, and is back when the keyboard goes.
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

  // The keyboard has just taken the bottom of the sheet, and the field being
  // typed in may be in what it took. By hand, not scrollIntoView, which would
  // scroll the page too — the very thing a sheet has to stay out of.
  const roomHeight = room?.height
  useLayoutEffect(() => {
    const box = body.current
    const field = document.activeElement
    if (!roomHeight || !box || !field || !box.contains(field)) return
    const shown = box.getBoundingClientRect()
    const rect = field.getBoundingClientRect()
    // A long note will not fit whatever is done; the browser follows its caret.
    if (rect.height > shown.height) return
    if (rect.bottom > shown.bottom) box.scrollTop += rect.bottom - shown.bottom + CLEARANCE
    else if (rect.top < shown.top) box.scrollTop -= shown.top - rect.top + CLEARANCE
  }, [roomHeight])

  /**
   * Pulled down by its top edge, it goes, as a sheet does on a phone.
   *
   * Only the grip and title row take the drag — the content under them
   * scrolls, and a pull there has to stay a scroll. Only a finger, too: a
   * mouse has the X. Let go past DISMISS and it closes; short of it, it
   * springs back.
   */
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const from = useRef<number | null>(null)

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // The X lives in this row. Capturing a touch that starts on it would
    // send its click to the row instead, and the X would stop working.
    if (event.pointerType !== 'touch' || (event.target as Element).closest('button')) return
    from.current = event.clientY
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (from.current !== null) setDrag(Math.max(0, event.clientY - from.current))
  }
  const onPointerUp = () => {
    if (from.current === null) return
    from.current = null
    setDragging(false)
    if (drag > DISMISS) onClose()
    else setDrag(0)
  }

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
    <div
      style={room ? { top: room.top, height: room.height, bottom: 'auto' } : undefined}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      {/* Fixed, so it still covers the page while the sheet is in the strip above the keyboard. */}
      <div className="fixed inset-0 bg-neutral-900/25 animate-fade-in" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          minHeight: (room ? Math.min(floor, room.height) : floor) || undefined,
          maxHeight: room?.height,
          transform: drag ? `translateY(${drag}px)` : undefined,
          transition: dragging ? 'none' : 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        // max-w-lg, not md: on a phone the sheet is the screen either way, and
        // on a desktop md is 448px of a 1900px screen to write a paragraph in.
        className={`relative w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-xl ${arrival}`}
      >
        {/* The grip says the sheet can be pulled down; the row below it is
            where the pull is taken. Phone only — a centred dialog has no
            bottom edge to go to. */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="shrink-0 touch-none"
        >
          <span aria-hidden className="mx-auto mt-2 block h-[5px] w-10 rounded-full bg-neutral-200 sm:hidden" />
          <div className="flex items-center justify-between px-5 pt-2 pb-3 sm:pt-4">
            <h2
              className={
                large
                  ? 'text-[22px] font-extrabold tracking-[-0.02em]'
                  : 'text-[17px] font-semibold tracking-tight'
              }
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label={tr('Close', '关闭')}
              className="p-1.5 -mr-1.5 rounded-full text-neutral-400 hover:bg-neutral-100 active:bg-neutral-100"
            >
              <Close />
            </button>
          </div>
        </div>
        {/* min-h-0 is what lets this scroll inside a capped column; flex-1 is
            what makes it absorb the floor above rather than leaving a gap
            under the footer. */}
        <div
          ref={body}
          className={`min-h-0 flex-1 overflow-y-auto px-5 ${footer ? 'pb-4' : 'pb-safe-5'}`}
        >
          {children}
        </div>
        {/* Over a keyboard there is no home indicator to clear, and every line
            given back here is a line more of the form. */}
        {footer && (
          <div
            className={`shrink-0 border-t border-neutral-100 bg-white px-5 pt-4 sm:rounded-b-3xl ${
              room ? 'pb-3' : 'pb-safe-7'
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
