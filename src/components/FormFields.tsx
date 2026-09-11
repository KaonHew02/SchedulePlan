import { useRef, useState, type ReactNode } from 'react'
import CalendarPanel from './DatePicker'
import { CalendarIcon, ClockIcon, Close } from './Icons'
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
            onPick={(time) => {
              onChange(time)
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
