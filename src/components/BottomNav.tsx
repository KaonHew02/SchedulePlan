import type { Screen } from '../types'
import { NAV } from './navItems'

export default function BottomNav({
  current,
  onChange,
}: {
  current: Screen
  onChange: (screen: Screen) => void
}) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 lg:hidden">
      {/*
        One cell per module, counted rather than written down: the column count
        used to be `grid-cols-6` in this file and the list of modules lives in
        another, which is two places to remember and one of them was going to
        be forgotten.
        
        It is seven now. On a 320px phone that is 45px a cell, and neither
        'Reminders' nor 'Translate' fits at 11px — hence the smaller type below
        640px and the truncate. Shrinking the word is better than the two
        alternatives: a label that wraps to two lines makes the bar taller than
        the content it sits under, and one that overflows pushes the page
        sideways. Past seven the honest answer is a different bar, not a
        smaller font.
      */}
      <div
        className="mx-auto grid max-w-md border-t border-neutral-100 bg-white/90 backdrop-blur pb-safe sm:border-x sm:border-neutral-200 md:max-w-xl"
        style={{ gridTemplateColumns: `repeat(${NAV.length}, minmax(0, 1fr))` }}
      >
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-current={current === id ? 'page' : undefined}
            className={`flex min-w-0 flex-col items-center gap-1 py-2.5 transition-colors ${
              current === id ? 'text-neutral-900' : 'text-neutral-400'
            }`}
          >
            <Icon className="w-[22px] h-[22px]" />
            <span className="w-full truncate px-0.5 text-center text-[10px] sm:text-[11px]">
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
