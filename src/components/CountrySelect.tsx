import { useMemo, useRef, useState } from 'react'
import { ChevronDown } from './Icons'
import Popover from './Popover'
import CountryBadge from './CountryBadge'
import { COUNTRIES, countryOf } from '../lib/places'

/**
 * Picking a country.
 *
 * Search matches the name or the code, and the list is short enough after two
 * keystrokes that ordering beyond alphabetical earns nothing. Recently used
 * ones are floated to the top, because a notebook's next trip is very often to
 * somewhere it already knows about.
 */
export default function CountrySelect({
  value,
  onChange,
  recent = [],
  label = 'Country',
  placeholder = 'Pick a country',
  clearable = false,
}: {
  value: string | null
  onChange: (code: string | null) => void
  /** Codes to show first — the ones already in the notebook. */
  recent?: string[]
  label?: string
  placeholder?: string
  clearable?: boolean
}) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const ordered = useMemo(() => {
    const first = recent
      .map((code) => countryOf(code))
      .filter((country): country is NonNullable<typeof country> => Boolean(country))
    const seen = new Set(first.map((country) => country.code))
    return [...first, ...COUNTRIES.filter((country) => !seen.has(country.code))]
  }, [recent])

  const matches = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return ordered
    return ordered.filter(
      (country) =>
        country.name.toLowerCase().includes(text) || country.code.toLowerCase() === text,
    )
  }, [ordered, query])

  const chosen = countryOf(value)

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
        className={`flex min-w-0 items-center gap-1.5 rounded-xl bg-neutral-100 px-3 py-1.5 text-[15px] transition-colors hover:bg-neutral-200/70 ${
          open ? 'bg-neutral-200/70 ring-2 ring-brand-500/40' : ''
        }`}
      >
        {chosen ? (
          <>
            <CountryBadge code={chosen.code} />
            <span className="truncate">{chosen.name}</span>
          </>
        ) : (
          <span className="text-neutral-400">{placeholder}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
      </button>

      {open && (
        <Popover anchor={anchor} label={label} onClose={() => setOpen(false)}>
          <div className="w-[256px] p-2">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search countries"
              className="mb-1 w-full rounded-lg bg-neutral-100 px-3 py-2 text-[14px] outline-none placeholder:text-neutral-400"
            />
            <div className="no-scrollbar max-h-[228px] overflow-y-auto">
              {clearable && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-[14px] text-neutral-500 hover:bg-neutral-100"
                >
                  No country
                </button>
              )}
              {matches.length === 0 && (
                <p className="px-3 py-4 text-center text-[13px] text-neutral-400">
                  No country matches that.
                </p>
              )}
              {matches.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => {
                    onChange(country.code)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                    country.code === value ? 'bg-brand-50' : 'hover:bg-neutral-100'
                  }`}
                >
                  <CountryBadge code={country.code} />
                  <span
                    className={`truncate text-[14px] ${
                      country.code === value ? 'font-medium text-brand-700' : ''
                    }`}
                  >
                    {country.name}
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
