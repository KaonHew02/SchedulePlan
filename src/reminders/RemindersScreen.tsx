import { useEffect, useMemo, useRef, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Fab from '../components/Fab'
import { dueAt, dueLabel, groupOf, isActive, isRange, occurrenceDays, at } from '../lib/reminders'
import { toggleReminder, useReminders } from '../lib/store'
import type { Reminder } from '../types'
import ReminderForm from './ReminderForm'

function Row({ reminder, onOpen }: { reminder: Reminder; onOpen: () => void }) {
  const active = !reminder.done && isRange(reminder) && isActive(reminder)

  return (
    <div className="flex items-start gap-3 border-b border-neutral-100 px-5 py-3.5">
      <button
        onClick={() => toggleReminder(reminder.id)}
        aria-label={reminder.done ? 'Mark as not done' : 'Mark as done'}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          reminder.done ? 'border-brand-500 bg-brand-500' : 'border-neutral-300'
        }`}
      >
        {reminder.done && (
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 13 4 4L19 7" />
          </svg>
        )}
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span
            className={`truncate text-[15px] leading-6 ${
              reminder.done ? 'text-neutral-400 line-through' : 'font-medium'
            }`}
          >
            {reminder.title}
          </span>
          {active && (
            <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
              On now
            </span>
          )}
        </div>
        <div className="text-[13px] leading-5 tabular-nums text-neutral-500">
          {dueLabel(reminder)}
          {reminder.notes && ` · ${reminder.notes}`}
        </div>
      </button>
    </div>
  )
}

export default function RemindersScreen({ onToast }: { onToast: (message: string) => void }) {
  const reminders = useReminders()
  const [form, setForm] = useState<{ reminder: Reminder | null } | null>(null)
  const [canAsk, setCanAsk] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'default',
  )
  // Only alert for things that fall due while the app is open. Firing for
  // everything already overdue at startup would be a wall of popups, and the
  // Overdue list says it better anyway.
  const openedAt = useRef(Date.now())
  const alerted = useRef(new Set<string>())

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      for (const reminder of reminders) {
        if (reminder.done) continue
        // A repeat has a moment per day, and each is its own alert — so the
        // key has to carry the day, not just the reminder.
        for (const day of occurrenceDays(reminder)) {
          const moment = at(day, reminder.time)
          const key = `${reminder.id}@${day}`
          if (alerted.current.has(key)) continue
          if (moment > openedAt.current && moment <= now) {
            alerted.current.add(key)
            onToast(reminder.title)
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(reminder.title, { body: dueLabel(reminder) })
            }
          }
        }
      }
    }
    const timer = setInterval(tick, 20_000)
    tick()
    return () => clearInterval(timer)
  }, [reminders, onToast])

  const sections = useMemo(() => {
    const now = Date.now()
    const open = reminders
      .filter((reminder) => !reminder.done)
      .sort((a, b) => dueAt(a, now) - dueAt(b, now))

    return [
      ['Overdue', open.filter((reminder) => groupOf(reminder, now) === 'overdue')],
      ['Today', open.filter((reminder) => groupOf(reminder, now) === 'today')],
      ['Upcoming', open.filter((reminder) => groupOf(reminder, now) === 'upcoming')],
      [
        'Done',
        reminders
          .filter((reminder) => reminder.done)
          .sort((a, b) => dueAt(b, now) - dueAt(a, now)),
      ],
    ] as [string, Reminder[]][]
  }, [reminders])

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="flex items-baseline justify-between px-5 pb-3 pt-4 lg:px-8">
          <h1 className="text-[19px] font-semibold tracking-tight lg:text-[22px]">Reminders</h1>
          {canAsk && (
            <button
              onClick={() => void Notification.requestPermission().then(() => setCanAsk(false))}
              className="text-[13px] font-medium text-brand-500"
            >
              Turn on alerts
            </button>
          )}
        </div>
      </header>

      <main className="pb-28 lg:px-8 lg:pb-10">
        {reminders.length === 0 ? (
          <EmptyState title="Nothing to remember" hint="Tap + to add something" />
        ) : (
          // Four sections down one column leaves a laptop mostly empty, and
          // they are independent lists, so they pair up side by side.
          <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10">
          {sections.map(([name, rows]) =>
            rows.length === 0 ? null : (
              <section key={name}>
                <h2
                  className={`px-5 pb-1 pt-4 text-[13px] font-medium ${
                    name === 'Overdue' ? 'text-red-600' : 'text-neutral-400'
                  }`}
                >
                  {name}
                </h2>
                {rows.map((reminder) => (
                  <Row
                    key={reminder.id}
                    reminder={reminder}
                    onOpen={() => setForm({ reminder })}
                  />
                ))}
              </section>
            ),
          )}
          </div>
        )}

        <p className="px-5 pt-6 text-[12px] leading-5 text-neutral-300 lg:px-0">
          Alerts only appear while SchedulePlan is open in a tab. There is no server to send them
          when it is closed.
        </p>
      </main>

      <Fab label="Add reminder" onClick={() => setForm({ reminder: null })} />

      {form && (
        <ReminderForm
          reminder={form.reminder}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null)
            onToast(message)
          }}
        />
      )}
    </>
  )
}
