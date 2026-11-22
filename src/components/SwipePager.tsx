import { useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react'

/** How far, as a share of the width, a slow drag has to go to turn the page. */
const TURN_SHARE = 0.25
/** A flick this fast (px per ms) turns it however short it was. */
const FLICK_SPEED = 0.35
/** Movement before the drag decides whether it is sideways or a scroll. */
const SLOP = 8
const DURATION = 240
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * Swipe sideways to turn the page, the way a phone's calendar goes to the
 * next month.
 *
 * The pages either side are drawn next to this one, so the finger pulls the
 * next month into view instead of dragging a blank edge, and letting go
 * slides it the rest of the way. The parent decides what a page is: `render`
 * is called with -1, 0 and 1, and `onTurn` with the direction once the slide
 * has finished. When `pageKey` changes the strip is put back in the middle —
 * in the same frame as the new page is drawn, so nothing jumps.
 *
 * A finger only. A mouse has the arrows, and a mouse drag across dates would
 * be selecting them. `touch-action: pan-y` leaves an up-and-down drag to the
 * browser as the page scroll it always was; only a sideways one comes here.
 *
 * The strip is moved by writing its transform directly, not through state:
 * a re-render on every pointer move would redraw three months of dates sixty
 * times a second.
 */
export default function SwipePager({
  pageKey,
  render,
  onTurn,
  className = '',
}: {
  pageKey: string
  render: (offset: -1 | 0 | 1) => ReactNode
  onTurn: (direction: 1 | -1) => void
  className?: string
}) {
  const frame = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const sides = useRef<{ [K in -1 | 1]: HTMLDivElement | null }>({ [-1]: null, 1: null })
  const drag = useRef<{
    id: number
    x: number
    y: number
    sideways: boolean | null
    lastX: number
    lastT: number
    speed: number
  } | null>(null)
  const turning = useRef(false)
  /** A drag that turned or moved the page ends in a click; that click is not a tap. */
  const swallowClick = useRef(false)

  const move = (x: number, animate: boolean) => {
    const el = strip.current
    if (!el) return
    el.style.transition = animate ? `transform ${DURATION}ms ${EASE}` : 'none'
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : ''
  }

  // The new page is in the middle now; put the strip back under it.
  useLayoutEffect(() => {
    turning.current = false
    move(0, false)
    if (frame.current) {
      frame.current.style.transition = ''
      frame.current.style.height = ''
    }
  }, [pageKey])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swallowClick.current = false
    if (event.pointerType !== 'touch' || turning.current || drag.current) return
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      sideways: null,
      lastX: event.clientX,
      lastT: event.timeStamp,
      speed: 0,
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== event.pointerId) return
    const dx = event.clientX - d.x
    const dy = event.clientY - d.y
    if (d.sideways === null) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      d.sideways = Math.abs(dx) > Math.abs(dy)
      if (!d.sideways) {
        // A scroll; the browser has it.
        drag.current = null
        return
      }
      // Captured only now: capturing at the start would send every tap's
      // click to this frame instead of the date under the finger. A touch is
      // held by what it started on anyway, so a capture that fails (the
      // finger already gone) loses nothing.
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Nothing to do.
      }
      swallowClick.current = true
    }
    const dt = event.timeStamp - d.lastT
    if (dt > 0) d.speed = (event.clientX - d.lastX) / dt
    d.lastX = event.clientX
    d.lastT = event.timeStamp
    move(dx, false)
  }

  const finish = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current
    if (!d || d.id !== event.pointerId) return
    drag.current = null
    if (!d.sideways) return
    // iOS seldom sends a click after a drag at all; when none comes, the flag
    // must not be left to eat the next one, a keyboard Enter say.
    window.setTimeout(() => (swallowClick.current = false), 400)

    const width = frame.current?.offsetWidth ?? 0
    const dx = event.clientX - d.x
    // A finger that paused before lifting is not flicking.
    const speed = event.timeStamp - d.lastT > 80 ? 0 : d.speed
    const far = Math.abs(dx) > width * TURN_SHARE
    const flick = Math.abs(speed) > FLICK_SPEED && Math.sign(speed) === Math.sign(dx)
    if (cancelled || !width || !(far || flick)) {
      move(0, true)
      return
    }

    // Swiping left brings in what is to the right: the next page.
    const direction: 1 | -1 = dx < 0 ? 1 : -1
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onTurn(direction)
      return
    }
    turning.current = true
    move(-direction * width, true)
    // Months are four, five or six weeks tall; grow or shrink to the one
    // coming in while it slides, rather than jumping once it has arrived.
    const box = frame.current
    const next = sides.current[direction]
    if (box && next && next.offsetHeight !== box.offsetHeight) {
      box.style.height = `${box.offsetHeight}px`
      void box.offsetHeight
      box.style.transition = `height ${DURATION}ms ${EASE}`
      box.style.height = `${next.offsetHeight}px`
    }
    // A timer rather than transitionend, which never comes if the strip was
    // already there, and would leave the page stuck.
    window.setTimeout(() => onTurn(direction), DURATION)
  }

  return (
    <div
      ref={frame}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finish(event, false)}
      onPointerCancel={(event) => finish(event, true)}
      onClickCapture={(event) => {
        if (!swallowClick.current) return
        swallowClick.current = false
        event.stopPropagation()
        event.preventDefault()
      }}
      className={`relative touch-pan-y overflow-hidden ${className}`}
    >
      <div ref={strip} className="relative">
        {render(0)}
        {([-1, 1] as const).map((offset) => (
          <div
            key={offset}
            ref={(el) => {
              sides.current[offset] = el
            }}
            aria-hidden
            inert
            className={`absolute top-0 w-full ${offset < 0 ? 'right-full' : 'left-full'}`}
          >
            {render(offset)}
          </div>
        ))}
      </div>
    </div>
  )
}
