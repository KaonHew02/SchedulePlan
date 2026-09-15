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
 *
 * Committing and *closing* are two different things, though, and treating
 * them as one made the hour column nearly useless: picking 16 shut the panel,
 * so setting 16:45 meant opening the picker twice. A time is read left to
 * right and set the same way, so an hour leaves the panel up with the minutes
 * under your thumb, and the minute — the last thing anybody picks — closes
 * it. Every pick is already saved by then, so dismissing it any other way
 * loses nothing either.
 */

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))

/**
 * Every minute, not every fifth.
 *
 * Five was a reasonable guess about what anybody schedules, and it is wrong
 * about the times that matter most here: a flight leaves at 06:55 and lands at
 * 14:22, and a picker that cannot say 22 makes you round your own boarding
 * pass. Sixty rows scroll more, which the column already does for hours, and
 * it opens centred on the minute you are already on.
 */
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'))

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

  /*
   * Open on the value that is already chosen.
   *
   * Two things had to be got right here, and neither was, which nobody could
   * see while a minute column was twelve rows long: at that length every value
   * is nearly in view wherever the list happens to rest.
   *
   * The panel is in a portal that positions itself a frame after it mounts, so
   * the first attempt to centre can run while the column still has no height
   * to centre inside — hence the second pass on the next frame.
   *
   * And the column is `scroll-smooth`, which is right for a finger and wrong
   * for this: assigning scrollTop started an animation from the top of a
   * sixty-row list, which is a picker visibly winding itself to where it
   * should have opened. 'instant' jumps.
   */
  useLayoutEffect(() => {
    const centre = () => {
      const container = list.current
      const item = active.current
      if (!container || !item) return
      // By hand, not scrollIntoView: that would also scroll the page, and the
      // page is a sheet that has no business moving.
      container.scrollTo({
        top: item.offsetTop - container.clientHeight / 2 + item.clientHeight / 2,
        behavior: 'instant',
      })
    }
    centre()
    const frame = requestAnimationFrame(centre)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      ref={list}
      role="listbox"
      aria-label={label}
      className="no-scrollbar h-[228px] flex-1 overflow-y-auto scroll-smooth px-1.5 py-1"
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
            className={`mb-0.5 w-full rounded-lg py-1.5 text-center text-[15px] tabular-nums transition-colors ${
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
  onDone,
  onClear,
  /** A start time, when this field is the end of something. Drives the nudges. */
  relativeTo,
}: {
  value: string
  /** Commits a time. Called on every tap; does not close the panel. */
  onPick: (time: string) => void
  /** The time is settled — close. Never fires without an `onPick` before it. */
  onDone: () => void
  onClear?: () => void
  relativeTo?: string | null
}) {
  /** A whole time in one tap: commit it and get out of the way. */
  const pickAndClose = (time: string) => {
    onPick(time)
    onDone()
  }

  const [currentHour, currentMinute] = value ? value.split(':') : [null, null]

  // With nothing chosen yet, a tap on one column still has to produce a whole
  // time. These are what the other half falls back to.
  const baseHour = currentHour ?? (relativeTo ? relativeTo.split(':')[0] : nowTime().split(':')[0])
  const baseMinute = currentMinute ?? '00'

  return (
    <div className="w-[196px] p-1.5">
      <div className="flex gap-1">
        <Column
          label="Hour"
          values={HOURS}
          selected={currentHour}
          restingAt={baseHour}
          onPick={(hour) => onPick(`${hour}:${baseMinute}`)}
          /* No close here — the minutes are the other half of the job. */
        />
        <div className="my-3 w-px bg-neutral-100" />
        {/* No rounding on the way in any more: every minute is in the list,
            so the highlight always lands on the value the item actually has.
            It used to show 08:37 sitting on 35. */}
        <Column
          label="Minute"
          values={MINUTES}
          selected={currentMinute}
          restingAt={baseMinute}
          onPick={(minute) => pickAndClose(`${baseHour}:${minute}`)}
        />
      </div>

      {relativeTo && (
        <div className="flex gap-1 border-t border-neutral-100 px-1 pt-1.5">
          {NUDGES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => pickAndClose(addMinutes(relativeTo, minutes))}
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
          onClick={() => pickAndClose(nowTime())}
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
