import type { ComponentType } from 'react'
import type { Screen } from '../types'
import { BellIcon, CalendarIcon, GlobeIcon, MoreIcon, SwapIcon, WalletIcon } from './Icons'

/**
 * The modules, in the order both navs show them.
 *
 * One list, read by the bottom bar and the sidebar. They used to keep a copy
 * each, which was fine at five tabs and is exactly the sort of thing that
 * drifts the first time a sixth is added.
 *
 * Currency is a module rather than a tool behind More because on a trip it is
 * opened as often as the schedule is — it sits after Reminders, where the
 * money half of the app already is.
 */
export const NAV: { id: Screen; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: 'schedule', label: 'Schedule', Icon: CalendarIcon },
  { id: 'travel', label: 'Travel', Icon: GlobeIcon },
  { id: 'expenses', label: 'Expenses', Icon: WalletIcon },
  { id: 'reminders', label: 'Reminders', Icon: BellIcon },
  { id: 'currency', label: 'Currency', Icon: SwapIcon },
  { id: 'more', label: 'More', Icon: MoreIcon },
]
