import { useEffect, useMemo, useRef, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Fab from '../components/Fab'
import { relativeDay, shortDate, todayISO } from '../lib/date'
import { byDue, toggleReminder, useReminders } from '../lib/store'
import type { Reminder } from '../types'
import ReminderForm from './ReminderForm'

const dueAt = (reminder: Reminder) => new Date(`${reminder.date}T${reminder.time}`).getTime()

/** 'Today 14:00', 'Tomorrow 09:00', '12 Sep 09:00'. */
function dueLabel(reminder: Reminder): string {
  const relative = relativeDay(reminder.date)
  const day = ['Today', 'Tomorrow', 'Yesterday'].includes(relative)
    ? relative
    : shortDate(reminder.date)
  return `${day} ${reminder.time}`
}

function Row({ reminder, onOpen }: { reminder: Reminder; onOpen: () => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-neutral-100 px-5 py-3.5">
      <button
        onClick={() => toggleReminder(reminder.id)}
        aria-label={reminder.done ? 'Mark as not done' : 'Mark as done'}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          reminder.done ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-300'
        }`}
      >
        {reminder.done && (
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 13 4 4L19 7" />
          </svg>
        )}
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div
          className={`text-[15px] leading-6 ${
            reminder.done ? 'text-neutral-400 line-through' : 'font-medium'
          }`}
        >
          {reminder.title}
        </div>
        <div className="text-[13px] leading-5 text-neutral-500 tabular-nums">
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
  const alerted = useRef(new Set<number>())

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      for (const reminder of reminders) {
        if (reminder.done || alerted.current.has(reminder.id)) continue
        const due = dueAt(reminder)
        if (due > openedAt.current && due <= now) {
          alerted.current.add(reminder.id)
          onToast(reminder.title)
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(reminder.title, { body: dueLabel(reminder) })
          }
        }
      }
    }
    const timer = setInterval(tick, 20_000)
    tick()
    return () => clearInterval(timer)
  }, [reminders, onToast])

  const groups = useMemo(() => {
    const today = todayISO()
    const now = Date.now()
    const open = reminders.filter((reminder) => !reminder.done).sort(byDue)
    return {
      overdue: open.filter((reminder) => dueAt(reminder) < now && reminder.date !== today),
      today: open.filter((reminder) => reminder.date === today),
      upcoming: open.filter((reminder) => reminder.date > today),
      done: reminders.filter((reminder) => reminder.done).sort(byDue).reverse(),
    }
  }, [reminders])

  const sections: [string, Reminder[]][] = [
    ['Overdue', groups.overdue],
    ['Today', groups.today],
    ['Upcoming', groups.upcoming],
    ['Done', groups.done],
  ]

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="flex items-baseline justify-between px-5 pt-4 pb-3">
          <h1 className="text-[19px] font-semibold tracking-tight">Reminders</h1>
          {canAsk && (
            <button
              onClick={() =>
                void Notification.requestPermission().then(() => setCanAsk(false))
              }
              className="text-[13px] font-medium text-blue-600"
            >
              Turn on alerts
            </button>
          )}
        </div>
      </header>

      <main className="pb-28">
        {reminders.length === 0 ? (
          <EmptyState title="Nothing to remember" hint="Tap + to add something" />
        ) : (
          sections.map(([name, rows]) =>
            rows.length === 0 ? null : (
              <section key={name}>
                <h2
                  className={`px-5 pt-4 pb-1 text-[13px] font-medium ${
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
          )
        )}

        <p className="px-5 pt-6 text-[12px] leading-5 text-neutral-300">
          Alerts only appear while SchedulePlan is open in a tab. There is no server to send
          them when it is closed.
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
