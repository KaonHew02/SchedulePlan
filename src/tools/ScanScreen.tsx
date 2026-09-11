import { useRef, useState } from 'react'
import { useFileUrl } from '../components/Attachments'
import { DateField, TimeField } from '../components/FormFields'
import { CameraIcon, CheckIcon, ScanIcon, Spinner } from '../components/Icons'
import { ChevronLeft } from '../components/Icons'
import { todayISO } from '../lib/date'
import { readFile, saveBlob, scanFilter } from '../lib/files'
import { parseItinerary, readText, type ItineraryDraft, type OcrProgress } from '../lib/ocr'
import { store } from '../lib/store'
import type { Attachment } from '../types'

/**
 * Point it at a booking confirmation, a printed plan, a page of a notebook.
 *
 * Two useful things come out. One is the scan itself — lighting flattened,
 * paper white, ink black — which can be saved as a file like any other
 * scanner's output. The other is a guess at the *appointments* in it, which is
 * where the care goes: a parser looking at OCR output will misread times and
 * invent entries, so nothing it finds is written anywhere. Every row is
 * ticked, edited and confirmed first, and untick-all is one tap away.
 */

interface Row extends ItineraryDraft {
  key: number
  keep: boolean
}

export default function ScanScreen({
  onBack,
  onToast,
}: {
  onBack: () => void
  onToast: (message: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const preview = useFileUrl(attachment?.id ?? null)

  async function handle(file: File) {
    setError(null)
    setRows([])
    setText('')
    setAttachment(null)
    setProgress({ status: 'Flattening the page', progress: 0 })

    let saved: Attachment
    try {
      const flattened = await scanFilter(file)
      saved = await saveBlob(flattened, file.name || 'Scan', 'scan')
      setAttachment(saved)
    } catch (err) {
      setProgress(null)
      setError(err instanceof Error ? err.message : "That page couldn't be prepared.")
      return
    }

    try {
      const blob = await readFile(saved.id)
      const found = await readText(blob ?? file, setProgress)
      setText(found)
      setAttachment({ ...saved, text: found.trim() || null })
      const drafts = parseItinerary(found, todayISO())
      setRows(drafts.map((draft, index) => ({ ...draft, key: index, keep: true })))
      if (!found.trim()) setError('No text could be made out on that page.')
      else if (drafts.length === 0) {
        setError('Text was read, but nothing in it looked like a dated appointment.')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "That page couldn't be read. The scan is kept.",
      )
    } finally {
      setProgress(null)
    }
  }

  function edit(key: number, patch: Partial<Row>) {
    setRows((was) => was.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  async function addChosen() {
    const chosen = rows.filter((row) => row.keep)
    if (chosen.length === 0) return
    setSaving(true)
    setError(null)
    try {
      for (const [index, row] of chosen.entries()) {
        await store.createSchedule({
          date: row.date,
          end_date: null,
          all_day: !row.start_time,
          start_time: row.start_time ?? '00:00',
          end_time: row.end_time,
          title: row.title,
          location: row.location,
          notes: null,
          tag: null,
          // The page itself goes with the first item only. Pointing several
          // records at one blob would mean deleting any of them takes the
          // scan away from the rest.
          attachments: index === 0 && attachment ? [attachment] : [],
        })
      }
      onToast(`Added ${chosen.length} to the schedule`)
      onBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add those.')
      setSaving(false)
    }
  }

  function download() {
    if (!preview || !attachment) return
    const link = document.createElement('a')
    link.href = preview
    link.download = attachment.name.replace(/\.[^.]+$/, '') + '-scan.jpg'
    link.click()
  }

  const chosenCount = rows.filter((row) => row.keep).length

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-1 px-3 pb-3 pt-4">
          <button onClick={onBack} aria-label="Back to More" className="p-1.5 text-neutral-400">
            <ChevronLeft />
          </button>
          <h1 className="text-[19px] font-semibold tracking-tight">Document scanner</h1>
        </div>
      </header>

      <main className="px-5 pb-28">
        {!attachment && !progress && (
          <>
            <p className="pb-4 pt-1 text-[14px] leading-6 text-neutral-500">
              Photograph a booking, an itinerary or any printed page. It is straightened and read
              on this device — nothing is uploaded, and no account is involved.
            </p>
            <button
              onClick={() => input.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 py-12 text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-500"
            >
              <CameraIcon className="h-8 w-8" />
              <span className="text-[14px] font-medium">Take or choose a photo</span>
            </button>
            <p className="pt-3 text-[12px] leading-5 text-neutral-400">
              The reader is a ~12 MB download the first time, then it stays for the session.
            </p>
          </>
        )}

        {progress && (
          <div className="py-14 text-center">
            <Spinner className="mx-auto h-6 w-6 text-neutral-400" />
            <p className="mt-3 text-[14px] text-neutral-600">{progress.status}…</p>
            <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${Math.max(4, Math.round(progress.progress * 100))}%` }}
              />
            </div>
          </div>
        )}

        {attachment && !progress && (
          <>
            <div className="flex gap-3">
              {preview && (
                <img
                  src={preview}
                  alt="The scanned page"
                  className="h-32 w-24 shrink-0 rounded-xl border border-neutral-200 object-cover"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <button
                  onClick={download}
                  className="rounded-full border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-neutral-600"
                >
                  Save the scan
                </button>
                <button
                  onClick={() => input.current?.click()}
                  className="flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[13px] text-neutral-600"
                >
                  <ScanIcon className="h-3.5 w-3.5" />
                  Scan another
                </button>
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-800">
                {error}
              </p>
            )}

            {rows.length > 0 && (
              <>
                <div className="flex items-baseline justify-between pb-1 pt-6">
                  <h2 className="text-[13px] font-medium text-neutral-400">
                    Found {rows.length} {rows.length === 1 ? 'thing' : 'things'}
                  </h2>
                  <button
                    onClick={() =>
                      setRows((was) => {
                        const allOn = was.every((row) => row.keep)
                        return was.map((row) => ({ ...row, keep: !allOn }))
                      })
                    }
                    className="text-[13px] font-medium text-blue-600"
                  >
                    {rows.every((row) => row.keep) ? 'Untick all' : 'Tick all'}
                  </button>
                </div>

                <div className="divide-y divide-neutral-100 border-y border-neutral-100">
                  {rows.map((row) => (
                    <div key={row.key} className="flex gap-3 py-3">
                      <button
                        onClick={() => edit(row.key, { keep: !row.keep })}
                        aria-label={row.keep ? 'Do not add this' : 'Add this'}
                        aria-pressed={row.keep}
                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          row.keep ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'
                        }`}
                      >
                        {row.keep && <CheckIcon className="h-3 w-3" />}
                      </button>

                      <div className={`min-w-0 flex-1 ${row.keep ? '' : 'opacity-40'}`}>
                        <input
                          value={row.title}
                          onChange={(event) => edit(row.key, { title: event.target.value })}
                          aria-label="What it is"
                          className="w-full bg-transparent text-[15px] outline-none"
                        />
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <DateField
                            value={row.date}
                            onChange={(date) => edit(row.key, { date })}
                            label="Date"
                          />
                          <TimeField
                            label="Start"
                            value={row.start_time ?? ''}
                            onChange={(time) => edit(row.key, { start_time: time || null })}
                            placeholder="All day"
                            clearable
                          />
                        </div>
                        {row.location && (
                          <p className="mt-1 truncate text-[12px] text-neutral-400">
                            {row.location}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addChosen}
                  disabled={chosenCount === 0 || saving}
                  className="mt-5 w-full rounded-full bg-neutral-900 py-3 text-[15px] font-medium text-white disabled:opacity-40"
                >
                  {saving
                    ? 'Adding...'
                    : chosenCount === 0
                      ? 'Nothing ticked'
                      : `Add ${chosenCount} to the schedule`}
                </button>
                <p className="pt-2 text-[12px] leading-5 text-neutral-400">
                  Check each date and time first — a reader working off a photo gets them wrong
                  often enough to matter. The scan itself is kept with the first one.
                </p>
              </>
            )}

            {text && (
              <details className="mt-6">
                <summary className="cursor-pointer text-[13px] text-neutral-400">
                  All the text it read
                </summary>
                <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-[12px] leading-5 text-neutral-600">
                  {text}
                </p>
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(text).then(() => onToast('Text copied'))
                  }}
                  className="mt-2 rounded-full border border-neutral-200 px-3 py-1.5 text-[13px] text-neutral-600"
                >
                  Copy the text
                </button>
              </details>
            )}
          </>
        )}

        {!attachment && error && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-800">
            {error}
          </p>
        )}

        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void handle(file)
          }}
        />
      </main>
    </>
  )
}
