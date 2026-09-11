import { useRef, useState } from 'react'
import { useFileUrl } from '../components/Attachments'
import CurrencySelect from '../components/CurrencySelect'
import { DateField, Field, TextField } from '../components/FormFields'
import { CameraIcon, ScanIcon, Spinner } from '../components/Icons'
import Sheet from '../components/Sheet'
import { plain } from '../lib/currency'
import { readFile, saveBlob, scanFilter } from '../lib/files'
import { parseReceipt, readText, type OcrProgress, type ReceiptFields } from '../lib/ocr'
import type { Attachment } from '../types'

/**
 * Photograph a receipt, read it, and check what it read.
 *
 * The review step is not a nicety. Browser-side OCR on a crumpled thermal
 * slip gets the shop name right most of the time and the total right much of
 * the time, and there is no version of this where a wrong number silently
 * becomes an expense. So every field it guessed lands in a box you can
 * correct, the other amounts it saw are offered as one-tap alternatives, and
 * nothing is saved until the form behind this is saved.
 */

export interface ScanResult {
  title: string | null
  date: string | null
  amount: number | null
  currency: string | null
  attachment: Attachment
}

export default function ReceiptScan({
  defaultCurrency,
  onClose,
  onUse,
}: {
  defaultCurrency: string
  onClose: () => void
  onUse: (result: ScanResult) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [found, setFound] = useState<ReceiptFields | null>(null)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)

  const preview = useFileUrl(attachment?.id ?? null)

  async function handle(file: File) {
    setError(null)
    setFound(null)
    setProgress({ status: 'Flattening the photo', progress: 0 })

    let saved: Attachment
    try {
      // Scanned, not merely stored: dropping the shadows out of a phone photo
      // is worth several percent of recognition accuracy on a thermal slip.
      const flattened = await scanFilter(file)
      saved = await saveBlob(flattened, file.name || 'Receipt', 'scan')
      setAttachment(saved)
    } catch (err) {
      setProgress(null)
      setError(err instanceof Error ? err.message : "That photo couldn't be prepared.")
      return
    }

    try {
      // Read the flattened copy, not the original: the whole point of the
      // filter is that it is easier to recognise.
      const flattened = await readFile(saved.id)
      const text = await readText(flattened ?? file, setProgress)
      const fields = parseReceipt(text)
      setFound(fields)
      setTitle(fields.merchant ?? '')
      setDate(fields.date ?? '')
      setAmount(fields.total === null ? '' : String(fields.total))
      if (fields.currency) setCurrency(fields.currency)
      // The text goes with the image, so the expense stays searchable later.
      setAttachment({ ...saved, text: text.trim() || null })
      if (!text.trim()) {
        setError('No text could be made out. Fill it in yourself — the photo is kept either way.')
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} The photo is kept — fill the rest in yourself.`
          : "That receipt couldn't be read.",
      )
      setFound({ merchant: null, date: null, currency: null, total: null, candidates: [] })
    } finally {
      setProgress(null)
    }
  }

  const ready = attachment !== null && progress === null

  return (
    <Sheet
      onClose={onClose}
      title="Scan a receipt"
      footer={
        ready ? (
          <button
            type="button"
            onClick={() =>
              onUse({
                title: title.trim() || null,
                date: date || null,
                amount: amount ? Number(amount) : null,
                currency,
                attachment: attachment as Attachment,
              })
            }
            className="w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white"
          >
            Use this
          </button>
        ) : undefined
      }
    >
      {!attachment && !progress && (
        <>
          <p className="pb-4 text-[14px] leading-6 text-neutral-500">
            Lay the receipt flat and fill the frame. The photo is straightened and read on this
            device — nothing is uploaded anywhere.
          </p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 py-10 text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-500"
          >
            <CameraIcon className="h-7 w-7" />
            <span className="text-[14px] font-medium">Take or choose a photo</span>
          </button>
          <p className="pb-2 pt-3 text-[12px] leading-5 text-neutral-400">
            The reader is a ~12 MB download the first time you use it, and it stays for the rest
            of the session.
          </p>
        </>
      )}

      {progress && (
        <div className="py-10 text-center">
          <Spinner className="mx-auto h-6 w-6 text-neutral-400" />
          <p className="mt-3 text-[14px] text-neutral-600">{progress.status}…</p>
          <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
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
                alt="Scanned receipt"
                className="h-28 w-24 shrink-0 rounded-xl border border-neutral-200 object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-5 text-neutral-500">
                Check every line before you use it. Nothing is saved until you save the expense.
              </p>
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="mt-2 flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[13px] text-neutral-600"
              >
                <ScanIcon className="h-3.5 w-3.5" />
                Retake
              </button>
            </div>
          </div>

          <div className="mt-4 divide-y divide-neutral-100 border-y border-neutral-100">
            <Field label="Where">
              <TextField
                label="Merchant"
                value={title}
                onChange={setTitle}
                placeholder="Shop name"
              />
            </Field>
            <Field label="Date">
              <DateField value={date} onChange={setDate} placeholder="Pick a date" clearable />
            </Field>
            <Field label="Amount">
              <span className="flex items-center gap-2">
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  aria-label="Amount"
                  placeholder="0.00"
                  className="w-24 bg-transparent text-right text-[15px] tabular-nums outline-none placeholder:text-neutral-300"
                />
                <CurrencySelect value={currency} onChange={setCurrency} />
              </span>
            </Field>
          </div>

          {found && found.candidates.length > 1 && (
            <div className="mt-3">
              <p className="pb-1.5 text-[12px] text-neutral-400">
                Other amounts on the slip — tap one if the total is wrong
              </p>
              <div className="flex flex-wrap gap-1.5">
                {found.candidates.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmount(String(value))}
                    className={`rounded-full border px-3 py-1 text-[13px] tabular-nums transition-colors ${
                      amount === String(value)
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-neutral-200 text-neutral-600'
                    }`}
                  >
                    {plain(value, currency)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {attachment.text && (
            <details className="mt-4">
              <summary className="cursor-pointer text-[13px] text-neutral-400">
                What it read
              </summary>
              <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-[12px] leading-5 text-neutral-600">
                {attachment.text}
              </p>
            </details>
          )}
        </>
      )}

      {error && (
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
    </Sheet>
  )
}
