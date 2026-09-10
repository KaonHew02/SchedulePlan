import type { Screen } from '../types'
import { BellIcon, CalendarIcon, MoreIcon, WalletIcon } from './Icons'

const items = [
  { id: 'schedule' as const, label: 'Schedule', Icon: CalendarIcon },
  { id: 'expenses' as const, label: 'Expenses', Icon: WalletIcon },
  { id: 'reminders' as const, label: 'Reminders', Icon: BellIcon },
  { id: 'more' as const, label: 'More', Icon: MoreIcon },
]

export default function BottomNav({
  current,
  onChange,
}: {
  current: Screen
  onChange: (screen: Screen) => void
}) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30">
      <div className="mx-auto grid max-w-md grid-cols-4 border-t border-neutral-100 bg-white/90 backdrop-blur pb-safe sm:border-x sm:border-neutral-200">
        {items.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-current={current === id ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
              current === id ? 'text-neutral-900' : 'text-neutral-400'
            }`}
          >
            <Icon className="w-[22px] h-[22px]" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}
