import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import CalendarPanel from './DatePicker'
import { CalendarIcon, ClockIcon, Close, ShrinkIcon, ZoomIcon } from './Icons'
import Popover from './Popover'
import TimePanel from './TimePicker'
import { addDays, shortDate, todayISO, weekdayShort } from '../lib/date'

/** One row of a form: its label on the left, its control on the right. */
export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="shrink-0 text-[14px] text-neutral-500">
        {label}
        {hint && <span className="block text-[11px] text-neutral-300">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

/**
 * The chip both pickers sit behind. A button, not an input: what used to be
 * here was a native date/time field made invisible and laid over a chip, and
 * it brought the whole native picker's behaviour with it.
 */
const chip =
  'relative flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-1.5 text-[15px] tabular-nums transition-colors hover:bg-neutral-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40'

const chipOpen = 'bg-neutral-200/70 ring-2 ring-brand-500/40'

/** 'Today, 10 Sep' — the year only shows when it isn't this one. */
export function dateLabel(iso: string): string {
  const today = todayISO()
  const day =
    iso === today
      ? 'Today'
      : iso === addDays(today, 1)
        ? 'Tomorrow'
        : iso === addDays(today, -1)
          ? 'Yesterday'
          : weekdayShort(iso)
  const year = iso.slice(0, 4) === today.slice(0, 4) ? '' : ` ${iso.slice(0, 4)}`
  return `${day}, ${shortDate(iso)}${year}`
}

export function DateField({
  value,
  onChange,
  label = 'Date',
  placeholder = 'Pick a date',
  clearable = false,
  rangeStart,
  min,
}: {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  clearable?: boolean
  /** When this field closes a range, the day it opened on. */
  rangeStart?: string | null
  min?: string | null
}) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label={label}
        aria-expanded={open}
        className={`${chip} ${open ? chipOpen : ''}`}
      >
        <span className={value ? '' : 'text-neutral-400'}>
          {value ? dateLabel(value) : placeholder}
        </span>
        <CalendarIcon className="h-4 w-4 text-neutral-400" />
      </button>

      {open && (
        <Popover anchor={anchor} label={label} onClose={() => setOpen(false)}>
          <CalendarPanel
            value={value}
            rangeStart={rangeStart}
            min={min}
            onPick={(iso) => {
              onChange(iso)
              setOpen(false)
            }}
            onClear={
              clearable
                ? () => {
                    onChange('')
                    setOpen(false)
                  }
                : undefined
            }
          />
        </Popover>
      )}
    </>
  )
}

export function TimeField({
  value,
  onChange,
  label,
  placeholder = 'Pick a time',
  clearable = false,
  relativeTo,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  /** Optional times need a way back to empty once the picker has filled them. */
  clearable?: boolean
  /** The start time, when this is an end. Turns on the +30m / +1h nudges. */
  relativeTo?: string | null
}) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label={label}
        aria-expanded={open}
        className={`${chip} ${open ? chipOpen : ''}`}
      >
        <span className={value ? '' : 'text-neutral-400'}>{value || placeholder}</span>
        <ClockIcon className="h-4 w-4 text-neutral-400" />
      </button>

      {open && (
        <Popover anchor={anchor} label={label} onClose={() => setOpen(false)}>
          <TimePanel
            value={value}
            relativeTo={relativeTo}
            onPick={onChange}
            onDone={() => setOpen(false)}
            onClear={
              clearable
                ? () => {
                    onChange('')
                    setOpen(false)
                  }
                : undefined
            }
          />
        </Popover>
      )}
    </>
  )
}

/** The on/off switch, for things like All day. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors ${
        checked ? 'bg-brand-500' : 'bg-neutral-200'
      }`}
    >
      {/*
        The knob moves by `left`, not by a transform.
        
        It used to have no horizontal anchor at all — `absolute` with
        `left: auto`, so it started at its *static* position, plus a translate
        to slide it. That put the knob at 22..42 in a 44px track: inside, but
        2px off the right edge against 22px on the left, which is close enough
        to the end that the white circle and its shadow read as escaping.
        
        Two numbers that have to add up to the right place is how that
        happened. One number that *is* the place cannot drift, and it no
        longer depends on where the browser thinks a box with no anchor would
        have gone: 3..23 off, 21..41 on, 3px of track either side.
      */}
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[21px]' : 'left-[3px]'
        }`}
      />
    </button>
  )
}

/** A small row of mutually exclusive choices. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-full bg-neutral-100 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-full px-3 py-1.5 text-[13px] transition-colors ${
            value === option.value ? 'bg-white font-medium shadow-sm' : 'text-neutral-500'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** A right-aligned text box that matches the chip rows around it. */
export function TextField({
  value,
  onChange,
  placeholder = 'Optional',
  label,
  type = 'text',
  inputMode,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
  type?: string
  inputMode?: 'text' | 'decimal' | 'numeric'
}) {
  return (
    <input
      value={value}
      type={type}
      inputMode={inputMode}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-w-0 flex-1 bg-transparent text-right text-[15px] outline-none placeholder:text-neutral-300"
    />
  )
}

/**
 * The notes box, which grows as it is written in.
 *
 * It was two rows and could not be dragged, which is a postage stamp to write
 * a paragraph in: type a third line and the first scrolls out of sight, so
 * checking what you just wrote means scrolling a box the height of two lines.
 * K writes an address, the fare, the opening hours and a paragraph on the
 * place into these — that was never two rows of work.
 *
 * Growing beats a bigger fixed box because most notes are one line and a
 * permanently tall empty well is its own kind of wrong. It opens at four rows,
 * follows what is typed, and stops at two fifths of the screen so the Save
 * button is never pushed off the bottom — past that it scrolls, which by then
 * is a long note rather than a cramped field.
 *
 * And past *that* there is the corner button, which is the one every chat box
 * has: growing to two fifths of the screen is generous for a note and still
 * cramped for writing up a day. Expanding hands the field the whole sheet
 * rather than opening a second window over it — the form is one panel, and a
 * panel over a panel to type a paragraph into is a lot of ceremony for a
 * bigger box.
 */
export function NotesField({
  value,
  onChange,
  placeholder = 'Notes',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Where the box sits in its form — borders and spacing, not size. */
  className?: string
}) {
  const box = useRef<HTMLTextAreaElement>(null)
  const [expanded, setExpanded] = useState(false)

  /*
   * Height is measured, not guessed: 'auto' first so scrollHeight reports what
   * the content needs rather than what the box is already stretched to. The
   * min and max live in CSS, so they clamp this without it having to know them.
   *
   * Expanded, the height is the CSS class's and nothing else's — writing a
   * short line must not collapse a box you just asked to be big. Clearing the
   * inline height is what hands control back, and re-running on the way out of
   * expanded is what takes it again.
   */
  useLayoutEffect(() => {
    const field = box.current
    if (!field) return
    if (expanded) {
      field.style.height = ''
      return
    }
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }, [value, expanded])

  /*
   * Land in the box that was just resized.
   *
   * 'start' on the way out, because an expanded box is taller than what is
   * left of the sheet below it and 'nearest' would show only its first few
   * lines. On the way back in it is small again, and moving the form under
   * the cursor for no reason is the ruder option.
   *
   * A tick late, and not smoothly. The sheet measures its own height in a
   * layout effect and sets a floor from it, which is another render — so
   * scrolling during this effect aims at a container whose height is still the
   * one from before the box grew, and stops a hundred pixels in. A timeout
   * runs after that second render has landed. Not smoothly, because a smooth
   * scroll begun against stale numbers spends its whole duration heading
   * somewhere wrong.
   *
   * Only on an actual change, which is why this compares against the last
   * value rather than flipping a "have I mounted" flag. StrictMode mounts an
   * effect, tears it down and mounts it again, and that flag is true by the
   * second pass — so editing an item that already has notes opened the form
   * with the cursor down in the notes box instead of in the title. Two equal
   * values are not a toggle, however many times the effect is run.
   */
  const was = useRef(expanded)
  useEffect(() => {
    if (was.current === expanded) return
    was.current = expanded
    box.current?.focus({ preventScroll: true })
    const settle = setTimeout(() => {
      box.current?.scrollIntoView({ block: expanded ? 'start' : 'nearest' })
    }, 0)
    return () => clearTimeout(settle)
  }, [expanded])

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={box}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        // pr-7 keeps the first line clear of the button sitting over the corner.
        className={`w-full resize-none overflow-y-auto bg-transparent pr-7 text-[15px] leading-6 outline-none placeholder:text-neutral-300 ${
          expanded ? 'h-[60vh]' : 'max-h-[40vh] min-h-[5.5rem]'
        }`}
      />
      <button
        type="button"
        onClick={() => setExpanded((was) => !was)}
        aria-label={expanded ? 'Shrink the notes box' : 'Expand the notes box'}
        aria-expanded={expanded}
        className="absolute right-0 top-0 rounded-lg p-1 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-500"
      >
        {expanded ? <ShrinkIcon className="h-4 w-4" /> : <ZoomIcon className="h-4 w-4" />}
      </button>
    </div>
  )
}

/** A clear button for an optional value that is already filled in. */
export function ClearButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="-mr-1 shrink-0 rounded-full p-1 text-neutral-300 hover:bg-neutral-100 hover:text-neutral-500"
    >
      <Close className="h-3.5 w-3.5" />
    </button>
  )
}
