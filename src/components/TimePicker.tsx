import { useLayoutEffect, useRef } from 'react'
import { addMinutes, nowTime } from '../lib/date'

/**
 * Hours down one column, minutes down the other.
 *
 * This exists because of a specific failure. Chrome's own time control on
 * Windows opens a three-column list — hour, minute, AM/PM — and only writes a
 * value back once **all three** have been set. Pick the hour and the meridiem,
 * which is all most people think a time needs, and the field hands back an
 * empty string. It looks exactly like a picker that silently refuses to save.
 *
 * So every tap here commits a whole time. Choose an hour and the minutes it
 * already had come with it; choose a minute and the hour does. There is no
 * half-entered state to lose.
 */

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, step) => String(step * 5).padStart(2, '0'))

/** How much later than the start a nudge chip offers to put the end. */
const NUDGES = [30, 60, 90, 120]

function Column({
  values,
  selected,
  /** Where to open when nothing is chosen yet. */
  restingAt,
  onPick,
  label,
}: {
  values: string[]
  selected: string | null
  restingAt: string
  onPick: (value: string) => void
  label: string
}) {
  const list = useRef<HTMLDivElement>(null)
  const active = useRef<HTMLButtonElement>(null)

  // An empty End field would otherwise open at 00, and an evening meeting is
  // then twenty hours of scrolling away. With nothing chosen it opens on the
  // hour it would guess anyway.
  const openAt = selected ?? restingAt

  useLayoutEffect(() => {
    const container = list.current
    const item = active.current
    if (!container || !item) return
    // Centre it by hand. scrollIntoView would also scroll the page, and the
    // page is a sheet that has no business moving.
    container.scrollTop = item.offsetTop - container.clientHeight / 2 + item.clientHeight / 2
  }, [])

  return (
    <div
      ref={list}
      role="listbox"
      aria-label={label}
      className="no-scrollbar h-[188px] flex-1 overflow-y-auto scroll-smooth px-1.5 py-1"
    >
      {values.map((value) => {
        const isSelected = value === selected
        return (
          <button
            key={value}
            ref={value === openAt ? active : undefined}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onPick(value)}
            className={`mb-0.5 w-full rounded-lg py-2 text-center text-[15px] tabular-nums transition-colors ${
              isSelected
                ? 'bg-brand-500 font-semibold text-white'
                : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            {value}
          </button>
        )
      })}
    </div>
  )
}

export function TimePanel({
  value,
  onPick,
  onClear,
  /** A start time, when this field is the end of something. Drives the nudges. */
  relativeTo,
}: {
  value: string
  onPick: (time: string) => void
  onClear?: () => void
  relativeTo?: string | null
}) {
  const [currentHour, currentMinute] = value ? value.split(':') : [null, null]

  // With nothing chosen yet, a tap on one column still has to produce a whole
  // time. These are what the other half falls back to.
  const baseHour = currentHour ?? (relativeTo ? relativeTo.split(':')[0] : nowTime().split(':')[0])
  const baseMinute = currentMinute ?? '00'

  // 07 and 22 are hours; 7 and 35 past are not. Round to the grid so the
  // highlight lands on something that is actually in the list.
  const shownMinute = currentMinute
    ? MINUTES.includes(currentMinute)
      ? currentMinute
      : String(Math.round(Number(currentMinute) / 5) * 5 % 60).padStart(2, '0')
    : null

  return (
    <div className="w-[196px] p-1.5">
      <div className="flex gap-1">
        <Column
          label="Hour"
          values={HOURS}
          selected={currentHour}
          restingAt={baseHour}
          onPick={(hour) => onPick(`${hour}:${baseMinute}`)}
        />
        <div className="my-3 w-px bg-neutral-100" />
        <Column
          label="Minute"
          values={MINUTES}
          selected={shownMinute}
          restingAt={MINUTES.includes(baseMinute) ? baseMinute : '00'}
          onPick={(minute) => onPick(`${baseHour}:${minute}`)}
        />
      </div>

      {relativeTo && (
        <div className="flex gap-1 border-t border-neutral-100 px-1 pt-1.5">
          {NUDGES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => onPick(addMinutes(relativeTo, minutes))}
              className="flex-1 rounded-lg py-1.5 text-[12px] font-medium text-neutral-500 hover:bg-neutral-100"
            >
              {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-t border-neutral-100 px-1 pt-1.5">
        <button
          type="button"
          onClick={() => onPick(nowTime())}
          className="flex-1 rounded-lg py-1.5 text-[13px] font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Now
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="flex-1 rounded-lg py-1.5 text-[13px] font-medium text-neutral-400 hover:bg-neutral-100"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

export default TimePanel
