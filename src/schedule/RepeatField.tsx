import { useRef, useState } from 'react'
import { DateField, Field, chip, chipOpen } from '../components/FormFields'
import { CheckIcon, RepeatIcon } from '../components/Icons'
import Popover from '../components/Popover'
import {
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
  choiceOf,
  presetLabel,
  presetRule,
  unitName,
  weekdayOf,
  type RepeatChoice,
} from '../lib/repeat'
import { MAX_EVERY } from '../lib/sanitize'
import type { RepeatUnit, ScheduleRepeat } from '../types'

const UNITS: RepeatUnit[] = ['day', 'week', 'month', 'year']

const CHIP_LABELS: Record<RepeatChoice, string> = {
  never: 'Never',
  day: 'Every day',
  week: 'Every week',
  month: 'Every month',
  year: 'Every year',
  custom: 'Custom',
}

/**
 * The Repeat rows of the schedule form.
 *
 * Most repeats are one of four — every day, week, month or year — so those
 * are one tap in a menu, the way a phone's calendar has them. Custom opens
 * the rule up in the form itself rather than in a second sheet: every how
 * many, of what, and for a week which days. The until row is for all of them,
 * because "every week until the end of term" is not a custom thing.
 *
 * These are rows of the same divided group as Date and Start, so it hands
 * back a fragment of Fields rather than a box of its own.
 */
export default function RepeatField({
  value,
  date,
  onChange,
}: {
  value: ScheduleRepeat | null
  /** The item's first day, which the presets and the weekday default read. */
  date: string
  onChange: (rule: ScheduleRepeat | null) => void
}) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  // Held apart from the rule: picking Custom and leaving it on every 1 week
  // is still Custom to the person looking at the panel they just opened.
  const [custom, setCustom] = useState(choiceOf(value, date) === 'custom')
  // The number box is text while it is being typed in. Clearing it to write
  // 12 goes through empty, and empty is not a rule.
  const [everyText, setEveryText] = useState(String(value?.every ?? 1))
  const choice: RepeatChoice = custom && value ? 'custom' : choiceOf(value, date)

  function pick(next: RepeatChoice) {
    setOpen(false)
    if (next === 'never') {
      setCustom(false)
      onChange(null)
      return
    }
    if (next === 'custom') {
      setCustom(true)
      const base = value ?? presetRule('week')
      // Custom weekly shows its days, so the one it was on has to be lit.
      const weekdays =
        base.unit === 'week' && base.weekdays.length === 0 ? [weekdayOf(date)] : base.weekdays
      setEveryText(String(base.every))
      onChange({ ...base, weekdays })
      return
    }
    setCustom(false)
    setEveryText('1')
    // The until date and skipped days are the series', not the preset's.
    onChange({ ...presetRule(next, value?.until ?? null), skip: value?.skip ?? [] })
  }

  function update(patch: Partial<ScheduleRepeat>) {
    if (value) onChange({ ...value, ...patch })
  }

  function typeEvery(text: string) {
    setEveryText(text)
    const every = Number(text)
    if (Number.isInteger(every) && every >= 1 && every <= MAX_EVERY) update({ every })
  }

  function toggleDay(day: number) {
    if (!value) return
    const on = value.weekdays.includes(day)
    // A week with no days in it is not a repeat; the last one stays lit.
    if (on && value.weekdays.length === 1) return
    update({
      weekdays: on
        ? value.weekdays.filter((d) => d !== day)
        : [...value.weekdays, day].sort((a, b) => a - b),
    })
  }

  function changeUnit(unit: RepeatUnit) {
    update({ unit, weekdays: unit === 'week' ? [weekdayOf(date)] : [] })
  }

  const options: { value: RepeatChoice; label: string }[] = [
    { value: 'never', label: 'Never' },
    ...UNITS.map((unit) => ({ value: unit, label: presetLabel(unit, date) })),
    { value: 'custom', label: 'Custom…' },
  ]

  return (
    <>
      <Field label="Repeat">
        <button
          ref={anchor}
          type="button"
          onClick={() => setOpen((was) => !was)}
          aria-label="Repeat"
          aria-expanded={open}
          className={`${chip} ${open ? chipOpen : ''}`}
        >
          <span className={value ? '' : 'text-neutral-400'}>{CHIP_LABELS[choice]}</span>
          <RepeatIcon className="h-4 w-4 text-neutral-400" />
        </button>
      </Field>

      {open && (
        <Popover anchor={anchor} label="Repeat" onClose={() => setOpen(false)}>
          <div className="w-[248px] p-1.5" role="listbox" aria-label="Repeat">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={choice === option.value}
                onClick={() => pick(option.value)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[14px] transition-colors hover:bg-neutral-100"
              >
                <span>{option.label}</span>
                {choice === option.value && <CheckIcon className="h-4 w-4 text-brand-500" />}
              </button>
            ))}
          </div>
        </Popover>
      )}

      {value && choice === 'custom' && (
        <>
          <Field label="Every">
            <span className="flex items-center gap-2">
              <input
                value={everyText}
                onChange={(event) => typeEvery(event.target.value)}
                onBlur={() => setEveryText(String(value.every))}
                inputMode="numeric"
                aria-label="Every how many"
                className="w-12 rounded-xl bg-neutral-100 px-2 py-1.5 text-center text-[15px] tabular-nums outline-none focus:ring-2 focus:ring-brand-500/40"
              />
              <select
                value={value.unit}
                onChange={(event) => changeUnit(event.target.value as RepeatUnit)}
                aria-label="Repeat unit"
                className="rounded-xl bg-neutral-100 px-3 py-1.5 text-[15px] outline-none transition-colors hover:bg-neutral-200/70 focus:ring-2 focus:ring-brand-500/40"
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unitName(unit, value.every)}
                  </option>
                ))}
              </select>
            </span>
          </Field>

          {value.unit === 'week' && (
            <Field label="On">
              <span className="flex gap-1">
                {WEEKDAY_LETTERS.map((letter, day) => {
                  const on = value.weekdays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      aria-pressed={on}
                      aria-label={WEEKDAY_NAMES[day]}
                      className={`h-8 w-8 rounded-full text-[12px] font-medium transition-colors ${
                        on
                          ? 'bg-brand-500 text-white'
                          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200/70'
                      }`}
                    >
                      {letter}
                    </button>
                  )
                })}
              </span>
            </Field>
          )}
        </>
      )}

      {value && (
        <Field label="Until">
          <DateField
            label="Repeat until"
            value={value.until ?? ''}
            onChange={(until) => update({ until: until || null })}
            placeholder="Forever"
            clearable
            min={date}
          />
        </Field>
      )}
    </>
  )
}
