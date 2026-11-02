import type { ComponentType } from 'react'
import { MONEY } from '../lib/features'
import { tr } from '../lib/i18n'
import type { Screen } from '../types'
import {
  BellIcon,
  CalendarIcon,
  GearIcon,
  GlobeIcon,
  GridIcon,
  SunriseIcon,
  SwapIcon,
  TranslateIcon,
  WalletIcon,
} from './Icons'

/**
 * The modules, in the order the sidebar shows them.
 *
 * One list, read by the sidebar and — through TABS and SHEET below — by the
 * phone's tab bar and More sheet. They used to keep a copy each, which was
 * fine at five tabs and is exactly the sort of thing that drifts the first
 * time a sixth is added.
 *
 * Currency is a module rather than a tool behind More because on a trip it is
 * opened as often as the schedule is — it sits after Reminders, where the
 * money half of the app already is.
 *
 * Translate followed it out of More for the same reason and sits next to it:
 * on the trip these two were built for, the till and the person behind it are
 * the same thirty seconds. Seven is one more than the bottom bar was drawn
 * for — see BottomNav for what that costs.
 *
 * With Expenses parked it is six, which is what the bottom bar was drawn for
 * in the first place. Filtered rather than removed, so the entry and its
 * place in the order both survive being switched off.
 *
 * Seasons, the travel calendar, makes it seven again and sits next to Travel:
 * Travel is where you have been, Seasons is when to go next. Seven is what
 * BottomNav was already sized for while Expenses was in. Switching MONEY
 * back on would make eight, which BottomNav says is past what that bar can
 * hold — at that point one of the two belongs behind More.
 */
export const NAV: { id: Screen; label: string; zh: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: 'schedule', label: 'Schedule', zh: '日程', Icon: CalendarIcon },
  { id: 'travel', label: 'Travel', zh: '旅行', Icon: GlobeIcon },
  { id: 'seasons', label: 'Seasons', zh: '季节', Icon: SunriseIcon },
  ...(MONEY
    ? [{ id: 'expenses' as const, label: 'Expenses', zh: '支出', Icon: WalletIcon }]
    : []),
  { id: 'reminders', label: 'Reminders', zh: '提醒', Icon: BellIcon },
  { id: 'currency', label: 'Currency', zh: '汇率', Icon: SwapIcon },
  { id: 'translate', label: 'Translate', zh: '翻译', Icon: TranslateIcon },
  { id: 'more', label: 'Settings', zh: '设置', Icon: GearIcon },
]

/**
 * The phone's tab bar, which is not the list above laid out narrow.
 *
 * Seven cells across a phone was 53px each and 10px labels, and it read as a
 * web page's menu rather than an app's tabs. On a phone (asked for on
 * 2026-11-02, alongside MoneyFlow's) the bar is the three lists you add to —
 * Schedule, Travel, Reminders — with a + in the middle that adds to whichever
 * is open (lib/add.ts), and More, which slides up a sheet holding the rest.
 *
 * The cost is one more tap to Currency and Translate, which were put in the
 * bar because on a trip they are opened as often as the schedule. If that
 * turns out to matter more, swap one of them into TABS here and the screen it
 * replaces into SHEET; nothing else needs to change.
 */
export const TABS: Screen[] = ['schedule', 'travel', 'reminders']
export const SHEET: Screen[] = ['seasons', 'currency', 'translate', ...(MONEY ? ['expenses' as const] : []), 'more']

/** The phone's More tab: not a screen, so it is not in NAV. */
export const MORE_TAB = { label: 'More', zh: '更多', Icon: GridIcon }

export const navItem = (id: Screen) => NAV.find((item) => item.id === id)!

/**
 * A module's name in the app's language. Both are kept on the entry rather
 * than worked out once here, because this list is made when the app loads
 * and the language can change after that.
 */
export const navLabel = (item: { label: string; zh: string }): string => tr(item.label, item.zh)
