import { useSyncExternalStore } from 'react'

/**
 * Which language the app is drawn in: English or 中文.
 *
 * Every piece of text is written in both, side by side where it is used:
 *
 *     tr('Saved 3 items to Drive', '已把 3 项存到 Drive')
 *
 * rather than as a key into a table somewhere else. A key like
 * `backup.savedToDrive` has to be looked up to be read, and the two halves of
 * a sentence drift apart the first time one of them is edited without the
 * other in view. Next to each other, the Chinese is changed in the same edit
 * as the English or it is plainly missing.
 *
 * Kept on this device rather than in the notebook. It is how this phone is
 * read, not part of what is written in it — restoring from Drive on a laptop
 * set to English should not turn the phone's screens into English too.
 *
 * Nothing has to subscribe to use `tr`. App reads `useLang()` at the top, so
 * changing the language draws the whole tree again, and `tr` reads the
 * language as it is now. A component that keeps text in a `useMemo` puts
 * `useLang()` in the memo's dependencies, or it keeps the old language.
 */

export type Lang = 'en' | 'zh'

/** The choices, each written in its own language — the only way to find yours in a list you cannot read. */
export const LANGS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
]

const KEY = 'scheduleplan.lang'

/**
 * The saved choice, else the phone's own language: a phone set to Chinese
 * opens in 中文 the first time, everything else in English.
 */
function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'zh') return saved
  } catch {
    // Private mode on an old Safari throws on localStorage. The phone's language will do.
  }
  return typeof navigator !== 'undefined' && /^zh\b/i.test(navigator.language) ? 'zh' : 'en'
}

let current: Lang = initial()
const listeners = new Set<() => void>()

/** The lang attribute picks the font for the Chinese and tells a screen reader how to say it. */
function mark(lang: Lang): void {
  if (typeof document !== 'undefined') document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
}
mark(current)

export const getLang = (): Lang => current

export function setLang(lang: Lang): void {
  if (lang === current) return
  current = lang
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    // Not saved, but still switched for as long as the app is open.
  }
  mark(lang)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang)
}

/**
 * The English or the Chinese, whichever the app is in. Anything goes in —
 * a string, a template with numbers in it, or JSX where a sentence has a
 * bold word or a link inside it.
 */
export function tr<T>(en: T, zh: T): T {
  return current === 'zh' ? zh : en
}

/** For Intl: dates, numbers, and the names of countries, languages and currencies. */
export const locale = (): string => (current === 'zh' ? 'zh-CN' : 'en-GB')

/** True in 中文. For the few places that build a sentence differently rather than just swapping words. */
export const isZh = (): boolean => current === 'zh'
