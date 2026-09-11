import { useMemo, useRef, useState } from 'react'
import { ChevronDown } from './Icons'
import Popover from './Popover'
import { COMMON, CURRENCY_NAMES, readCache } from '../lib/currency'

/**
 * Picking a currency out of the hundred-odd the rate table carries.
 *
 * A plain dropdown of 160 three-letter codes is a scrolling exercise, so the
 * ones a trip from here actually uses sit at the top, and anything else is a
 * few keystrokes away. Typing matches the code or the name, because half the
 * time you know it as "baht" and not as THB.
 */
export default function CurrencySelect({
  value,
  onChange,
  label = 'Currency',
  /** Extra codes to offer even if the rate table has not loaded. */
  extra = [],
}: {
  value: string
  onChange: (code: string) => void
  label?: string
  extra?: string[]
}) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const codes = useMemo(() => {
    const table = readCache()
    const all = new Set([...COMMON, ...Object.keys(CURRENCY_NAMES), ...extra, value])
    for (const code of Object.keys(table?.rates ?? {})) all.add(code)
    // Common ones first, in their own order; the rest alphabetically after.
    const rest = [...all].filter((code) => !COMMON.includes(code)).sort()
    return [...COMMON.filter((code) => all.has(code)), ...rest]
  }, [extra, value])

  const matches = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return codes
    return codes.filter(
      (code) =>
        code.toLowerCase().includes(text) ||
        (CURRENCY_NAMES[code] ?? '').toLowerCase().includes(text),
    )
  }, [codes, query])

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          setQuery('')
          setOpen((was) => !was)
        }}
        className={`flex shrink-0 items-center gap-1 rounded-xl bg-neutral-100 px-3 py-1.5 text-[15px] font-medium tabular-nums transition-colors hover:bg-neutral-200/70 ${
          open ? 'bg-neutral-200/70 ring-2 ring-blue-500/40' : ''
        }`}
      >
        {value}
        <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
      </button>

      {open && (
        <Popover anchor={anchor} label={label} onClose={() => setOpen(false)}>
          <div className="w-[248px] p-2">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search currencies"
              className="mb-1 w-full rounded-lg bg-neutral-100 px-3 py-2 text-[14px] outline-none placeholder:text-neutral-400"
            />
            <div className="no-scrollbar max-h-[228px] overflow-y-auto">
              {matches.length === 0 && (
                <p className="px-3 py-4 text-center text-[13px] text-neutral-400">
                  No currency matches that.
                </p>
              )}
              {matches.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    onChange(code)
                    setOpen(false)
                  }}
                  className={`flex w-full items-baseline gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                    code === value ? 'bg-blue-50' : 'hover:bg-neutral-100'
                  }`}
                >
                  <span
                    className={`w-10 shrink-0 text-[14px] font-medium ${
                      code === value ? 'text-blue-700' : ''
                    }`}
                  >
                    {code}
                  </span>
                  <span className="truncate text-[13px] text-neutral-500">
                    {CURRENCY_NAMES[code] ?? ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Popover>
      )}
    </>
  )
}
