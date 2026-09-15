import { useState } from 'react'
import { LinkIcon, Plus, TrashIcon } from './Icons'
import { hostLabel, safeUrl } from '../lib/links'
import type { TripLink } from '../types'

/**
 * The links on a record, edited in place.
 *
 * Controlled, unlike the one on the trip page: a form collects everything
 * behind one Save, and a link pasted into an add sheet that was then abandoned
 * must not already be in the notebook. So this hands the list back up and
 * never writes anything itself.
 *
 * The url is put through `safeUrl` here as well as in the store — not because
 * the store's gate is in doubt, but because "that does not look like a link"
 * is worth hearing while the link is still in front of you, rather than as a
 * failed Save that takes the rest of the form down with it.
 */
export default function LinkEditor({
  links,
  onChange,
}: {
  links: TripLink[]
  onChange: (links: TripLink[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setAdding(false)
    setUrl('')
    setLabel('')
    setError(null)
  }

  function add() {
    const safe = safeUrl(url)
    if (!safe) {
      setError('That does not look like a link.')
      return
    }
    onChange([
      ...links,
      { id: links.reduce((max, row) => Math.max(max, row.id), 0) + 1, label: label.trim(), url: safe },
    ])
    reset()
  }

  return (
    <div>
      <div className="flex items-baseline justify-between pb-2">
        <p className="text-[13px] text-neutral-400">Links</p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-[13px] font-medium text-brand-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      {links.length > 0 && (
        <div className="mb-2 border-t border-neutral-100">
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-3 border-b border-neutral-100 py-2.5">
              <LinkIcon className="h-4 w-4 shrink-0 text-neutral-400" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[14px] leading-5">
                  {link.label || hostLabel(link.url)}
                </span>
                {link.label && (
                  <span className="block truncate text-[12px] leading-4 text-neutral-400">
                    {hostLabel(link.url)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onChange(links.filter((row) => row.id !== link.id))}
                aria-label={`Remove ${link.label || hostLabel(link.url)}`}
                className="shrink-0 p-1.5 text-neutral-300"
              >
                <TrashIcon className="h-[15px] w-[15px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="rounded-2xl bg-neutral-50 p-3">
          {/*
            Enter is caught rather than left alone. This sits inside the
            schedule form, so the default for a press in either box is to
            submit that form — saving the whole item and closing the sheet
            around a link that had not been added yet.
          */}
          <input
            autoFocus
            value={url}
            onChange={(event) => {
              setUrl(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              add()
            }}
            placeholder="Paste the link"
            inputMode="url"
            aria-label="Link address"
            className="w-full rounded-lg bg-white px-3 py-2 text-[14px] outline-none ring-1 ring-neutral-200 placeholder:text-neutral-300"
          />
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              add()
            }}
            placeholder="What is it? (optional)"
            aria-label="What the link is"
            className="mt-2 w-full rounded-lg bg-white px-3 py-2 text-[14px] outline-none ring-1 ring-neutral-200 placeholder:text-neutral-300"
          />
          {error && <p className="pt-2 text-[12px] leading-5 text-amber-700">{error}</p>}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={add}
              disabled={!url.trim()}
              className="rounded-full bg-brand-500 px-3.5 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
            >
              Add link
            </button>
            <button type="button" onClick={reset} className="px-2 py-1.5 text-[13px] text-neutral-400">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        links.length === 0 && (
          <p className="text-[13px] leading-5 text-neutral-300">
            The booking, a map pin, the vlog &mdash; anything about this that lives somewhere else.
          </p>
        )
      )}
    </div>
  )
}
