import { useEffect, useMemo, useRef, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Fab from '../components/Fab'
import { tr } from '../lib/i18n'
import { dueAt, dueLabel, groupOf, isActive, isRange, occurrenceDays, at } from '../lib/reminders'
import { toggleReminder, useReminders } from '../lib/store'
import type { Reminder } from '../types'
import ReminderForm from './ReminderForm'

/**
 * The section names in Chinese. The English name stays the section's key —
 * the list below is grouped and coloured by it — and only the heading is
 * swapped, so the grouping cannot depend on which language is on.
 */
const SECTION_ZH: Record<string, string> = {
  Overdue: '已过期',
  Today: '今天',
  Upcoming: '即将到来',
  Done: '已完成',
}

function Row({ reminder, onOpen }: { reminder: Reminder; onOpen: () => void }) {
  const active = !reminder.done && isRange(reminder) && isActive(reminder)

  return (
    <div className="flex items-start gap-3 border-b border-neutral-100 px-5 py-3.5">
      <button
        onClick={() => toggleReminder(reminder.id)}
        aria-label={reminder.done ? tr('Mark as not done', '标为未完成') : tr('Mark as done', '标为完成')}
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
        {/*
          The title wraps. It used to be a single truncated line, which is the
          right call for a name and the wrong one for a reminder: K writes
          these as instructions — "Kiosk → print boarding pass → T1/U1/V1
          Document Check → Immigration" — and the half that got cut was the
          half telling you what to do. A row is as tall as what it has to say.
        */}
        <div className="flex items-start gap-1.5">
          <span
            className={`text-[15px] leading-6 ${
              reminder.done ? 'text-neutral-400 line-through' : 'font-medium'
            }`}
          >
            {reminder.title}
          </span>
          {active && (
            <span className="mt-[3px] shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
              {tr('On now', '进行中')}
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

  // Sections pair up two to a row on a laptop, but only when there are two to
  // pair. With just one open list the grid put it in the left cell and left
  // the right half of the screen empty next to reminders that needed the room.
  const visible = useMemo(() => sections.filter(([, rows]) => rows.length > 0), [sections])

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm">
        <div className="flex items-baseline justify-between px-5 pb-3 pt-4 lg:px-8">
          <h1 className="text-[19px] font-semibold tracking-tight lg:text-[22px]">{tr('Reminders', '提醒')}</h1>
          {canAsk && (
            <button
              onClick={() => void Notification.requestPermission().then(() => setCanAsk(false))}
              className="text-[13px] font-medium text-brand-500"
            >
              {tr('Turn on alerts', '开启通知')}
            </button>
          )}
        </div>
      </header>

      <main className="pb-28 lg:px-8 lg:pb-10">
        {reminders.length === 0 ? (
          <EmptyState
            title={tr('Nothing to remember', '没有要记的事')}
            hint={tr('Tap + to add something', '点 + 添加')}
          />
        ) : (
          // Four sections down one column leaves a laptop mostly empty, and
          // they are independent lists, so they pair up side by side.
          <div
            className={
              visible.length > 1 ? 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10' : ''
            }
          >
          {visible.map(([name, rows]) =>
            rows.length === 0 ? null : (
              <section key={name}>
                <h2
                  className={`px-5 pb-1 pt-4 text-[13px] font-medium ${
                    name === 'Overdue' ? 'text-red-600' : 'text-neutral-400'
                  }`}
                >
                  {tr(name, SECTION_ZH[name] ?? name)}
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
          {tr(
            'Alerts only appear while SchedulePlan is open in a tab. There is no server to send them when it is closed.',
            '提醒只在 SchedulePlan 开着的时候弹出。没有服务器，关掉以后就收不到。',
          )}
        </p>
      </main>

      <Fab label={tr('Add reminder', '添加提醒')} onClick={() => setForm({ reminder: null })} />

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
