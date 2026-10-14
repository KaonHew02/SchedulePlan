import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Close, Spinner } from './Icons'
import { readFile } from '../lib/files'
import { tr } from '../lib/i18n'
import { openPdf, type Pdf } from '../lib/pdf'

/**
 * An attachment on the whole screen, to actually read.
 *
 * The sheet shows what a file is; this is for what it says — the booking
 * number on page two of a ticket, the small print on a scanned receipt. Every
 * page, one under the other, fitted to the width of the screen, and zoomed
 * the way the hand expects: pinch, double tap, or the buttons at the bottom.
 *
 * Zooming is done here rather than left to the browser, because the
 * browser's zoom is the whole app's: on an iPhone a pinch enlarged the header
 * and the close button along with the page, and let go somewhere else.
 */

/** Widest a page is laid out at 100%. On a big screen, wider is a page read by turning your head. */
const FIT_MAX = 880
/** Space round the pages, matching the p-3 on their wrapper. */
const PAD = 12
const GAP = 12
const MIN_ZOOM = 1
const MAX_ZOOM = 5
/** Where a double tap goes, and comes back from. */
const TAP_ZOOM = 2.5
/** How much one press of + or − changes. */
const STEP = 1.5

const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

export interface PdfState {
  pdf: Pdf | null
  failed: boolean
}

/** A stored PDF, opened for drawing, and closed again when no longer on screen. */
export function usePdf(id: string | null): PdfState {
  const [state, setState] = useState<PdfState>({ pdf: null, failed: false })

  useEffect(() => {
    if (!id) return
    let live = true
    let opened: Pdf | null = null

    void readFile(id)
      .then((blob) => {
        if (!blob) throw new Error('missing')
        return openPdf(blob)
      })
      .then(
        (pdf) => {
          if (!live) {
            pdf.close()
            return
          }
          opened = pdf
          setState({ pdf, failed: false })
        },
        () => {
          if (live) setState({ pdf: null, failed: true })
        },
      )

    return () => {
      live = false
      opened?.close()
      setState({ pdf: null, failed: false })
    }
  }, [id])

  return state
}

/**
 * One page as a picture `width` pixels wide, drawn only while `wanted`.
 *
 * The picture it had stays up until the new one is ready, so a change of
 * size sharpens a page rather than blanking it first.
 */
export function usePageImage(
  pdf: Pdf | null,
  page: number,
  width: number,
  wanted: boolean,
): string | null {
  const [url, setUrl] = useState<string | null>(null)
  const held = useRef<string | null>(null)

  const hold = useCallback((next: string | null) => {
    if (held.current) URL.revokeObjectURL(held.current)
    held.current = next
    setUrl(next)
  }, [])

  useEffect(() => () => hold(null), [hold])

  useEffect(() => {
    if (!wanted) {
      hold(null)
      return
    }
    if (!pdf || width <= 0) return
    let live = true
    pdf.draw(page, width, () => live).then(
      (png) => {
        if (live && png) hold(URL.createObjectURL(png))
      },
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [pdf, page, width, wanted, hold])

  return url
}

/**
 * A page of a PDF, drawn when it comes near the screen.
 *
 * Two pictures, because one would be either too blurry or too big. The plain
 * one is drawn for the screen at 100% and kept. The sharp one is drawn at the
 * zoom, for the pages in view only, and let go when they scroll away: at 300%
 * a page is forty megabytes of pixels, and a phone holding thirty of them is
 * a phone that closes the tab.
 */
function PdfPage({
  pdf,
  page,
  shape,
  fit,
  zoom,
  root,
}: {
  pdf: Pdf
  page: number
  shape: number
  fit: number
  zoom: number
  root: RefObject<HTMLDivElement | null>
}) {
  const box = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setNear(entry.isIntersecting)
        if (entry.isIntersecting) setSeen(true)
      },
      { root: root.current, rootMargin: '100% 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [root])

  const ratio = window.devicePixelRatio || 1
  const plain = usePageImage(pdf, page, fit * ratio, seen)
  const sharp = usePageImage(pdf, page, fit * zoom * ratio, near && zoom > 1.2)
  const url = sharp ?? plain

  return (
    <div
      ref={box}
      className="w-full overflow-hidden bg-white shadow-sm ring-1 ring-black/5"
      style={{ aspectRatio: shape }}
    >
      {url ? (
        <img
          src={url}
          alt={tr(`Page ${page + 1}`, `第 ${page + 1} 页`)}
          draggable={false}
          className="block h-full w-full select-none"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Spinner className="h-5 w-5 text-neutral-300" />
        </div>
      )}
    </div>
  )
}

/** Where to keep a point on screen across a change of zoom: its place on the pages, and on the screen. */
interface Anchor {
  x: number
  y: number
  screenX: number
  screenY: number
}

export default function FullView({
  name,
  pdf,
  image,
  onClose,
}: {
  name: string
  /** One or the other: a PDF's pages, or a picture's address. */
  pdf?: Pdf | null
  image?: string | null
  onClose: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const column = useRef<HTMLDivElement>(null)
  /** Width of a page at 100%, in CSS pixels. */
  const [fit, setFit] = useState(0)
  const [zoom, setZoom] = useState(1)
  /** The zoom once it has stopped changing: what the sharp pictures are drawn for. */
  const [settled, setSettled] = useState(1)
  const current = useRef(1)
  const anchor = useRef<Anchor | null>(null)

  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    const measure = () => setFit(Math.max(0, Math.min(FIT_MAX, element.clientWidth - 2 * PAD)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  /** Zoom, keeping the point at (screenX, screenY) under the finger. */
  const zoomAt = useCallback((next: number, screenX: number, screenY: number) => {
    const element = scroller.current
    const pages = column.current
    const zoom = clampZoom(next)
    if (!element || !pages || Math.abs(zoom - current.current) < 0.001) return
    anchor.current = {
      x: (element.scrollLeft + screenX - pages.offsetLeft) / pages.offsetWidth,
      y: (element.scrollTop + screenY - pages.offsetTop) / pages.offsetHeight,
      screenX,
      screenY,
    }
    current.current = zoom
    setZoom(zoom)
  }, [])

  // After the pages have been laid out at the new size, and before they are
  // painted: scroll so the anchored point is back where it was.
  useLayoutEffect(() => {
    const element = scroller.current
    const pages = column.current
    const point = anchor.current
    if (!element || !pages || !point) return
    anchor.current = null
    element.scrollLeft = pages.offsetLeft + point.x * pages.offsetWidth - point.screenX
    element.scrollTop = pages.offsetTop + point.y * pages.offsetHeight - point.screenY
  }, [zoom])

  useEffect(() => {
    const timer = setTimeout(() => setSettled(zoom), 250)
    return () => clearTimeout(timer)
  }, [zoom])

  const zoomCentre = useCallback(
    (next: number) => {
      const element = scroller.current
      if (element) zoomAt(next, element.clientWidth / 2, element.clientHeight / 2)
    },
    [zoomAt],
  )

  // Escape closes this, and only this: caught on the way down, before the
  // sheet underneath hears it and closes as well.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      } else if (event.key === '+' || event.key === '=') {
        zoomCentre(current.current * STEP)
      } else if (event.key === '-') {
        zoomCentre(current.current / STEP)
      } else if (event.key === '0') {
        zoomCentre(1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, zoomCentre])

  /*
   * Pinch, double tap and ctrl-scroll. Listeners of the page's own rather
   * than React's, because React's touch and wheel listeners cannot cancel
   * the browser's zoom — and cancelling it is the point.
   */
  useEffect(() => {
    const element = scroller.current
    const overlay = root.current
    if (!element || !overlay) return

    let pinch: {
      distance: number
      zoom: number
      scale: number
      screenX: number
      screenY: number
    } | null = null
    /** The finger down now, while it might still be a tap. */
    let press: { x: number; y: number; time: number } | null = null
    /** The tap before, while a second one would make it a double. */
    let tap: { x: number; y: number; time: number } | null = null

    const onScreen = (x: number, y: number): [number, number] => {
      const box = element.getBoundingClientRect()
      return [x - box.left, y - box.top]
    }

    const spread = (touches: TouchList): number =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)

    const start = (event: TouchEvent) => {
      const pages = column.current
      if (event.touches.length === 2 && pages) {
        event.preventDefault()
        const [screenX, screenY] = onScreen(
          (event.touches[0].clientX + event.touches[1].clientX) / 2,
          (event.touches[0].clientY + event.touches[1].clientY) / 2,
        )
        pinch = { distance: spread(event.touches), zoom: current.current, scale: 1, screenX, screenY }
        press = null
        // The pages grow from between the fingers while they move…
        pages.style.transformOrigin = `${element.scrollLeft + screenX - pages.offsetLeft}px ${
          element.scrollTop + screenY - pages.offsetTop
        }px`
      } else if (event.touches.length === 1) {
        press = { x: event.touches[0].clientX, y: event.touches[0].clientY, time: event.timeStamp }
      }
    }

    const move = (event: TouchEvent) => {
      const pages = column.current
      if (pinch && event.touches.length === 2 && pages) {
        event.preventDefault()
        pinch.scale = clampZoom((pinch.zoom * spread(event.touches)) / pinch.distance) / pinch.zoom
        pages.style.transform = `scale(${pinch.scale})`
      } else if (press) {
        const touch = event.touches[0]
        if (Math.hypot(touch.clientX - press.x, touch.clientY - press.y) > 10) press = null
      }
    }

    const end = (event: TouchEvent) => {
      const pages = column.current
      if (pinch) {
        // …and are laid out again at that size when they let go, which is
        // what makes the pictures sharp rather than stretched.
        if (event.touches.length < 2) {
          const done = pinch
          pinch = null
          if (pages) {
            pages.style.transform = ''
            pages.style.transformOrigin = ''
          }
          zoomAt(done.zoom * done.scale, done.screenX, done.screenY)
        }
        return
      }
      if (press && event.touches.length === 0 && event.timeStamp - press.time < 300) {
        const now = press
        if (tap && now.time - tap.time < 350 && Math.hypot(now.x - tap.x, now.y - tap.y) < 30) {
          // No click, and no double click after it to zoom a second time.
          event.preventDefault()
          const [screenX, screenY] = onScreen(now.x, now.y)
          zoomAt(current.current > 1.05 ? 1 : TAP_ZOOM, screenX, screenY)
          tap = null
        } else {
          tap = now
        }
      }
      press = null
    }

    const doubleClick = (event: MouseEvent) => {
      const [screenX, screenY] = onScreen(event.clientX, event.clientY)
      zoomAt(current.current > 1.05 ? 1 : TAP_ZOOM, screenX, screenY)
    }

    // A trackpad pinch arrives as a scroll with ctrl held, as does ctrl and
    // the mouse wheel.
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      const [screenX, screenY] = onScreen(event.clientX, event.clientY)
      const delta = Math.max(-50, Math.min(50, event.deltaY))
      zoomAt(current.current * Math.exp(-delta * 0.01), screenX, screenY)
    }

    // Safari's own pinch, which on an iPhone ignores the page's "do not zoom".
    const stop = (event: Event) => event.preventDefault()

    element.addEventListener('touchstart', start, { passive: false })
    element.addEventListener('touchmove', move, { passive: false })
    element.addEventListener('touchend', end, { passive: false })
    element.addEventListener('touchcancel', end)
    element.addEventListener('dblclick', doubleClick)
    element.addEventListener('wheel', wheel, { passive: false })
    overlay.addEventListener('gesturestart', stop)
    overlay.addEventListener('gesturechange', stop)
    return () => {
      element.removeEventListener('touchstart', start)
      element.removeEventListener('touchmove', move)
      element.removeEventListener('touchend', end)
      element.removeEventListener('touchcancel', end)
      element.removeEventListener('dblclick', doubleClick)
      element.removeEventListener('wheel', wheel)
      overlay.removeEventListener('gesturestart', stop)
      overlay.removeEventListener('gesturechange', stop)
    }
  }, [zoomAt])

  const control =
    'flex h-11 w-11 items-center justify-center text-[22px] leading-none transition-opacity disabled:opacity-30'

  // On the body, not in the sheet: a sheet that is still sliding in has a
  // transform, and anything "fixed" inside a transform is fixed to it rather
  // than to the screen.
  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={name}
      className="fixed inset-0 z-[60] flex flex-col bg-neutral-100 animate-fade-in"
    >
      <div
        className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white pb-2.5 pl-5 pr-3"
        style={{ paddingTop: 'calc(0.625rem + env(safe-area-inset-top, 0px))' }}
      >
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{name}</h2>
        {pdf && pdf.pages > 1 && (
          <span className="shrink-0 text-[13px] text-neutral-400">
            {tr(`${pdf.pages} pages`, `${pdf.pages} 页`)}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={tr('Close', '关闭')}
          className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 active:bg-neutral-100"
        >
          <Close />
        </button>
      </div>

      <div
        ref={scroller}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {/* w-max so a zoomed page can be scrolled to its right edge;
            min-w-full so a page narrower than the screen sits in the middle. */}
        <div className="relative w-max min-w-full p-3 pb-24">
          {fit > 0 && (
            <div
              ref={column}
              className="mx-auto flex flex-col"
              style={{ width: fit * zoom, gap: GAP }}
            >
              {pdf
                ? pdf.shapes.map((shape, page) => (
                    <PdfPage
                      key={page}
                      pdf={pdf}
                      page={page}
                      shape={shape}
                      fit={fit}
                      zoom={settled}
                      root={scroller}
                    />
                  ))
                : image && (
                    <img
                      src={image}
                      alt={name}
                      draggable={false}
                      className="block w-full select-none bg-white shadow-sm"
                    />
                  )}
            </div>
          )}
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 flex justify-center"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="pointer-events-auto flex items-center rounded-full bg-neutral-900/80 px-1 text-white shadow-lg">
          <button
            type="button"
            onClick={() => zoomCentre(zoom / STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label={tr('Zoom out', '缩小')}
            className={control}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => zoomCentre(1)}
            aria-label={tr('Fit to screen', '适合屏幕')}
            className="h-11 min-w-[3.5rem] text-[13px] font-medium tabular-nums"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoomCentre(zoom * STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label={tr('Zoom in', '放大')}
            className={control}
          >
            +
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
