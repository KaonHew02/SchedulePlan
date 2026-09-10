import type { Screen } from '../types'
import { CalendarIcon, MoreIcon, WalletIcon } from './Icons'

const items = [
  { id: 'schedule' as const, label: 'Schedule', Icon: CalendarIcon },
  { id: 'expenses' as const, label: 'Expenses', Icon: WalletIcon },
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
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur border-t border-neutral-100 pb-safe">
      <div className="mx-auto max-w-md grid grid-cols-3">
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
