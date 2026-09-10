import { useRef, type ReactNode } from 'react'
import { CalendarIcon, ClockIcon, Close } from './Icons'
import { addDays, shortDate, todayISO, weekdayShort } from '../lib/date'

/** One row of a form: its label on the left, its control on the right. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[14px] text-neutral-500">{label}</span>
      {children}
    </label>
  )
}

/**
 * The native date and time inputs carry the picker, but their default look is
 * bulky and reads '11/09/2026'. So the input is laid over a soft chip that
 * shows the value the way the rest of the app writes it, and a tap anywhere on
 * the chip opens the picker.
 */
const chip =
  'relative flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-1.5 text-[15px] tabular-nums transition-colors focus-within:ring-2 focus-within:ring-neutral-900/15'

const overlay = 'absolute inset-0 w-full h-full opacity-0 cursor-pointer'

function openPicker(input: HTMLInputElement | null) {
  // Not in every browser, and it throws if the picker is already up.
  try {
    input?.showPicker()
  } catch {
    /* The native field still opens on its own. */
  }
}

/** 'Today, 10 Sep' — the year only shows when it isn't this one. */
function dateLabel(iso: string): string {
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
}: {
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <span className={chip}>
      <span className={value ? '' : 'text-neutral-400'}>
        {value ? dateLabel(value) : 'Pick a date'}
      </span>
      <CalendarIcon className="w-4 h-4 text-neutral-400" />
      <input
        ref={ref}
        type="date"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onClick={() => openPicker(ref.current)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker(ref.current)
          }
        }}
        className={overlay}
      />
    </span>
  )
}

export function TimeField({
  value,
  onChange,
  label,
  placeholder = 'Pick a time',
  clearable = false,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  /** Optional times need a way back to empty once the picker has filled them. */
  clearable?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <span className={chip}>
      <span className={value ? '' : 'text-neutral-400'}>{value || placeholder}</span>
      {clearable && value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="relative z-10 -mr-1 rounded-full p-0.5 text-neutral-400 active:bg-neutral-200"
        >
          <Close className="w-3.5 h-3.5" />
        </button>
      ) : (
        <ClockIcon className="w-4 h-4 text-neutral-400" />
      )}
      <input
        ref={ref}
        type="time"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onClick={() => openPicker(ref.current)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker(ref.current)
          }
        }}
        className={overlay}
      />
    </span>
  )
}
