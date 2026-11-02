import type { ComponentType } from 'react'
import { pressAdd, useAddLabel } from '../lib/add'
import { tr } from '../lib/i18n'
import type { Screen } from '../types'
import { Plus } from './Icons'
import { MORE_TAB, SHEET, TABS, navItem, navLabel } from './navItems'

/**
 * The phone's tab bar: two tabs, the +, a tab, and More.
 *
 * Which screens get a tab, and why, is in navItems (TABS). The + is an action
 * rather than a place, so it does not look like a tab: a raised disc standing
 * a little proud of the bar. More is a tab that opens a sheet rather than a
 * screen, and it stays lit while any screen from that sheet is open, so the
 * bar always says where you are.
 *
 * `vt-tabbar` names it for the screen-change animation (index.css): the
 * screens fade and rise behind it while the bar itself stays put.
 */
export default function BottomNav({
  current,
  onChange,
  moreOpen,
  onMore,
}: {
  current: Screen
  onChange: (screen: Screen) => void
  moreOpen: boolean
  onMore: () => void
}) {
  const addLabel = useAddLabel()
  const tab = (id: Screen) => {
    const item = navItem(id)
    return (
      <Tab
        key={id}
        on={!moreOpen && current === id}
        label={navLabel(item)}
        Icon={item.Icon}
        onClick={() => onChange(id)}
      />
    )
  }

  return (
    <nav className="vt-tabbar fixed inset-x-0 bottom-0 z-30 select-none lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 border-t border-neutral-200/70 bg-white/85 px-1.5 pt-1.5 pb-safe-2 backdrop-blur-xl backdrop-saturate-[1.8] sm:border-x sm:border-neutral-200 md:max-w-xl">
        {TABS.slice(0, 2).map(tab)}

        <div className="flex justify-center">
          <button
            onClick={() => pressAdd(() => onChange('schedule'))}
            aria-label={addLabel ?? tr('Add to schedule', '添加日程')}
            className="-mt-[22px] grid h-[54px] w-[54px] place-items-center rounded-full bg-brand-500 text-white shadow-[0_6px_16px_rgba(108,92,231,0.38),0_0_0_5px_#fff] transition-[scale] duration-150 active:scale-[0.92]"
          >
            <Plus />
          </button>
        </div>

        {TABS.slice(2).map(tab)}

        <Tab
          on={moreOpen || SHEET.includes(current)}
          label={navLabel(MORE_TAB)}
          Icon={MORE_TAB.Icon}
          onClick={onMore}
          expanded={moreOpen}
        />
      </div>
    </nav>
  )
}

function Tab({
  on,
  label,
  Icon,
  onClick,
  expanded,
}: {
  on: boolean
  label: string
  Icon: ComponentType<{ className?: string }>
  onClick: () => void
  /** Only for More, which opens a sheet. */
  expanded?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-current={on && expanded === undefined ? 'page' : undefined}
      aria-expanded={expanded}
      className={`flex min-w-0 flex-col items-center gap-[3px] pb-0.5 pt-1 text-[11px] font-semibold transition-[color,scale] duration-150 active:scale-[0.92] ${
        on ? 'text-brand-600' : 'text-neutral-400'
      }`}
    >
      {/* The chosen tab's icon sits on a pill, the way a phone marks it. */}
      <span
        className={`grid h-[30px] w-14 place-items-center rounded-full transition-colors duration-200 ${
          on ? 'bg-brand-50' : ''
        }`}
      >
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span className="w-full truncate px-0.5 text-center">{label}</span>
    </button>
  )
}
