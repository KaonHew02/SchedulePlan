import type { ReactNode } from 'react'
import { headerDate, todayISO } from '../lib/date'

/**
 * A module's name at the top of its screen.
 *
 * On a phone it is set the way an app heads a page: today's date small above,
 * the name large under it. On a laptop the sidebar already says where you are,
 * so it is the 22px heading it always was, and the date is left out.
 */
export default function ScreenTitle({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[12px] font-semibold uppercase tracking-[0.04em] text-neutral-400 lg:hidden">
        {headerDate(todayISO())}
      </p>
      <h1 className="truncate text-[30px] font-extrabold leading-[1.15] tracking-[-0.025em] lg:text-[22px] lg:font-semibold lg:leading-normal lg:tracking-tight">
        {children}
      </h1>
    </div>
  )
}
