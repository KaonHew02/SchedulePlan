import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CheckIcon, ChevronDown, TranslateIcon } from './Icons'
import Popover from './Popover'
import { LANGS, setLang, tr, useLang, type Lang } from '../lib/i18n'

/**
 * English or 中文, beside Auto in the backup bar.
 *
 * A pill like the buttons next to it, opening the app's own popover rather
 * than a <select>. The native list looked like a different program on
 * Windows — a square grey box with a blue bar across it, under a pill with
 * rounded corners — and the other pickers here are already ours for the
 * reasons in the README's "The pickers are ours".
 *
 * Each choice is written in its own language, with the other language's
 * word for it underneath: someone who opened the app in a language they
 * cannot read still finds "English" or "中文" to tap, and can tell which is
 * which from the line under it.
 */

/** What each language is called in the other one — the small line under its name. */
const CALLED: Record<Lang, string> = { en: '英文', zh: 'Chinese' }

export default function LanguageSelect({ dark = false }: { dark?: boolean }) {
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const label = LANGS.find((choice) => choice.value === lang)?.label ?? lang

  // The current one takes the focus, so Enter keeps it and an arrow is one
  // press from the other. A frame late, not autoFocus: Popover is hidden for
  // its first frame while it measures, and a hidden button cannot be focused.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => items.current[LANGS.findIndex((c) => c.value === lang)]?.focus())
    return () => cancelAnimationFrame(frame)
    // Only on opening: choosing closes it anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function choose(value: Lang) {
    setLang(value)
    setOpen(false)
    anchor.current?.focus()
  }

  // Up and down move between the two, as they would in a native menu.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const at = items.current.findIndex((item) => item === document.activeElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    items.current[(at + step + LANGS.length) % LANGS.length]?.focus()
  }

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${tr('Language', '语言')}: ${label}`}
        className={`flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-brand-300 ${
          dark
            ? `rounded-lg text-neutral-300 hover:bg-white/10 ${open ? 'bg-white/10' : ''}`
            : `rounded-full border text-neutral-600 hover:bg-neutral-50 ${
                open ? 'border-brand-300 bg-brand-50/60' : 'border-neutral-200'
              }`
        }`}
      >
        <TranslateIcon className="h-3.5 w-3.5" />
        <span>{label}</span>
        <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <Popover anchor={anchor} label={tr('Language', '语言')} onClose={() => setOpen(false)}>
          <div role="menu" aria-label={tr('Language', '语言')} onKeyDown={onKeyDown} className="w-[200px] p-1.5">
            <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium text-neutral-400">{tr('Language', '语言')}</p>
            {LANGS.map((choice, i) => {
              const on = choice.value === lang
              return (
                <button
                  key={choice.value}
                  ref={(element) => {
                    items.current[i] = element
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => choose(choice.value)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-brand-300 ${
                    on ? 'bg-brand-50' : 'hover:bg-neutral-100'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[14px] font-medium ${on ? 'text-brand-700' : 'text-neutral-900'}`}>
                      {choice.label}
                    </span>
                    <span className="block text-[12px] text-neutral-400">{CALLED[choice.value]}</span>
                  </span>
                  {on && <CheckIcon className="h-4 w-4 text-brand-600" />}
                </button>
              )
            })}
          </div>
        </Popover>
      )}
    </>
  )
}
