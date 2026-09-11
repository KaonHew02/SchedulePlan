import { useEffect, useRef, useState } from 'react'
import { CameraIcon, FileIcon, PaperclipIcon, ScanIcon, Spinner, TrashIcon } from './Icons'
import Sheet from './Sheet'
import { isImage, prettySize, readFile, saveFile } from '../lib/files'
import { readText, type OcrProgress } from '../lib/ocr'
import type { Attachment } from '../types'

/**
 * Attachments, wherever they hang: a schedule item, an expense.
 *
 * Three ways in, because they are genuinely different jobs. **Attach** takes
 * anything — a PDF ticket, a booking email saved to disk. **Photo** takes a
 * picture and keeps it looking like a picture. **Scan** takes a picture of
 * paper and flattens the lighting out of it so the paper reads as white and
 * the ink as black, which is both easier to read later and much easier for
 * the text reader to work with.
 */

/** Anything a browser will either render or hand to another app. */
const ANY_FILE =
  'image/*,application/pdf,text/plain,text/csv,application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * An object URL for a stored blob, released when it is no longer on screen.
 *
 * Object URLs are a leak by default: the browser holds the blob alive until
 * the document is discarded or the URL is revoked by hand.
 */
export function useFileUrl(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setUrl(null)
      return
    }
    let live = true
    let created: string | null = null

    void readFile(id).then((blob) => {
      if (!blob) return
      if (!live) return
      created = URL.createObjectURL(blob)
      setUrl(created)
    })

    return () => {
      live = false
      if (created) URL.revokeObjectURL(created)
      setUrl(null)
    }
  }, [id])

  return url
}

function Thumb({ file, onOpen }: { file: Attachment; onOpen: () => void }) {
  const url = useFileUrl(isImage(file.type) ? file.id : null)

  return (
    <button
      type="button"
      onClick={onOpen}
      title={file.name}
      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 transition-colors hover:border-neutral-300"
    >
      {url ? (
        <img src={url} alt={file.name} className="h-full w-full object-cover" />
      ) : isImage(file.type) ? (
        <span className="flex h-full w-full items-center justify-center">
          <Spinner className="h-4 w-4 text-neutral-300" />
        </span>
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-neutral-400">
          <FileIcon className="h-5 w-5" />
          <span className="w-full truncate text-[9px] leading-none">
            {file.name.split('.').pop()?.slice(0, 5).toUpperCase()}
          </span>
        </span>
      )}
      {file.kind === 'scan' && (
        <span className="absolute bottom-0 inset-x-0 bg-neutral-900/70 py-0.5 text-center text-[9px] font-medium text-white">
          SCAN
        </span>
      )}
    </button>
  )
}

export function AttachmentStrip({
  files,
  onChange,
  onError,
}: {
  files: Attachment[]
  onChange: (files: Attachment[]) => void
  onError: (message: string) => void
}) {
  const pick = useRef<HTMLInputElement>(null)
  const photo = useRef<HTMLInputElement>(null)
  const scan = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<Attachment | null>(null)

  async function take(list: FileList | null, mode: 'file' | 'photo' | 'scan') {
    if (!list?.length) return
    setBusy(true)
    const added: Attachment[] = []
    try {
      for (const file of Array.from(list)) {
        added.push(await saveFile(file, { scan: mode === 'scan' }))
      }
      onChange([...files, ...added])
    } catch (err) {
      onChange([...files, ...added])
      onError(err instanceof Error ? err.message : "That file couldn't be attached.")
    } finally {
      setBusy(false)
    }
  }

  const button =
    'flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[13px] text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40'

  return (
    <div>
      {files.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {files.map((file) => (
            <Thumb key={file.id} file={file} onOpen={() => setViewing(file)} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => pick.current?.click()} className={button}>
          {busy ? <Spinner className="h-3.5 w-3.5" /> : <PaperclipIcon className="h-3.5 w-3.5" />}
          Attach
        </button>
        <button type="button" disabled={busy} onClick={() => photo.current?.click()} className={button}>
          <CameraIcon className="h-3.5 w-3.5" />
          Photo
        </button>
        <button type="button" disabled={busy} onClick={() => scan.current?.click()} className={button}>
          <ScanIcon className="h-3.5 w-3.5" />
          Scan
        </button>
      </div>

      {/* Three inputs rather than one: `capture` is what makes a phone open
          the camera instead of the gallery, and it cannot be toggled per tap. */}
      <input
        ref={pick}
        type="file"
        multiple
        accept={ANY_FILE}
        className="hidden"
        onChange={(event) => {
          const list = event.target.files
          event.target.value = ''
          void take(list, 'file')
        }}
      />
      <input
        ref={photo}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const list = event.target.files
          event.target.value = ''
          void take(list, 'photo')
        }}
      />
      <input
        ref={scan}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const list = event.target.files
          event.target.value = ''
          void take(list, 'scan')
        }}
      />

      {viewing && (
        <FileViewer
          file={viewing}
          onClose={() => setViewing(null)}
          onRemove={() => {
            onChange(files.filter((file) => file.id !== viewing.id))
            setViewing(null)
          }}
          onText={(text) => {
            const updated = { ...viewing, text }
            onChange(files.map((file) => (file.id === viewing.id ? updated : file)))
            setViewing(updated)
          }}
        />
      )}
    </div>
  )
}

export function FileViewer({
  file,
  onClose,
  onRemove,
  onText,
}: {
  file: Attachment
  onClose: () => void
  onRemove?: () => void
  /** Absent when the viewer is read-only. */
  onText?: (text: string) => void
}) {
  const url = useFileUrl(file.id)
  const [reading, setReading] = useState<OcrProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function read() {
    setError(null)
    setReading({ status: 'Starting', progress: 0 })
    try {
      const blob = await readFile(file.id)
      if (!blob) throw new Error('That attachment is missing from this browser.')
      const text = await readText(blob, setReading)
      onText?.(text.trim() || '')
      if (!text.trim()) setError('No text could be made out in that image.')
    } catch (err) {
      setError(err instanceof Error ? err.message : "That image couldn't be read.")
    } finally {
      setReading(null)
    }
  }

  function download() {
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
  }

  return (
    <Sheet onClose={onClose} title={file.name}>
      {isImage(file.type) ? (
        url ? (
          <img
            src={url}
            alt={file.name}
            className="max-h-[46vh] w-full rounded-xl border border-neutral-100 object-contain"
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl bg-neutral-50">
            <Spinner className="h-5 w-5 text-neutral-300" />
          </div>
        )
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-neutral-50 px-4 py-5">
          <FileIcon className="h-7 w-7 text-neutral-400" />
          <div className="min-w-0">
            <p className="truncate text-[15px]">{file.name}</p>
            <p className="text-[13px] text-neutral-400">{prettySize(file.size)}</p>
          </div>
        </div>
      )}

      <p className="mt-2 text-[12px] text-neutral-400">
        {prettySize(file.size)}
        {file.kind === 'scan' && ' · scanned'}
      </p>

      {file.text && (
        <div className="mt-3">
          <p className="pb-1 text-[13px] font-medium text-neutral-400">Text read from it</p>
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-[13px] leading-5 text-neutral-700">
            {file.text}
          </p>
        </div>
      )}

      {reading && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-[13px] text-brand-700">
          <Spinner className="h-4 w-4" />
          <span>{reading.status}…</span>
          <span className="ml-auto tabular-nums">{Math.round(reading.progress * 100)}%</span>
        </div>
      )}

      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

      <div className="mt-5 flex flex-wrap gap-2 pb-2">
        {onText && isImage(file.type) && (
          <button
            type="button"
            onClick={read}
            disabled={Boolean(reading)}
            className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-2.5 text-[14px] font-medium disabled:opacity-40"
          >
            <ScanIcon className="h-4 w-4" />
            {file.text ? 'Read again' : 'Read text'}
          </button>
        )}
        <button
          type="button"
          onClick={download}
          disabled={!url}
          className="rounded-full border border-neutral-200 px-4 py-2.5 text-[14px] font-medium disabled:opacity-40"
        >
          Save a copy
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-2.5 text-[14px] font-medium text-red-600"
          >
            <TrashIcon />
            Remove
          </button>
        )}
      </div>
    </Sheet>
  )
}

export default AttachmentStrip
