import type { Screen } from '../types'
import Logo from './Logo'
import { NAV } from './navItems'

/**
 * The laptop and desktop version of the bottom nav. A bar pinned to the bottom
 * of a 1080px-tall window is a phone habit, not a desktop one.
 */
export default function SideNav({
  current,
  onChange,
}: {
  current: Screen
  onChange: (screen: Screen) => void
}) {
  return (
    <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-neutral-200">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo size={28} />
        <span className="text-[15px] font-semibold tracking-tight">SchedulePlan</span>
      </div>

      <nav className="px-3">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-current={current === id ? 'page' : undefined}
            className={`mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors ${
              current === id
                ? 'bg-neutral-100 font-medium text-neutral-900'
                : 'text-neutral-500 hover:bg-neutral-50'
            }`}
          >
            <Icon className="h-[19px] w-[19px]" />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
