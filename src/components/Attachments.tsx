import { useEffect, useRef, useState } from 'react'
import FullView, { usePageImage, usePdf } from './FullView'
import { CameraIcon, FileIcon, PaperclipIcon, ScanIcon, Spinner, TrashIcon, ZoomIcon } from './Icons'
import Sheet from './Sheet'
import { isImage, prettySize, readFile, saveFile } from '../lib/files'
import { tr } from '../lib/i18n'
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

/** Shown inline in the viewer rather than as a file chip. */
const isPdf = (type: string): boolean => type === 'application/pdf'
const isText = (type: string): boolean =>
  type.startsWith('text/') || type === 'application/json'

/**
 * An object URL for a stored blob, released when it is no longer on screen.
 *
 * Object URLs are a leak by default: the browser holds the blob alive until
 * the document is discarded or the URL is revoked by hand.
 */
export type FileState = 'loading' | 'ready' | 'missing'

/**
 * The blob behind an attachment, and whether it is actually there.
 *
 * `missing` matters: a record can outlive its bytes. A backup restored
 * without them, a browser that evicted the file store, a half-finished
 * import — the row still says "11 attachments" and every one of them opens
 * nothing. Without this the screen cannot tell that apart from a PDF, and
 * draws the same grey page icon for both.
 *
 * `as` relabels the bytes before the URL is made, and it is a security
 * measure rather than a convenience. An object URL has this app's origin, and
 * a browser draws it by the blob's *own* type, not by what the record says it
 * is — so an "attachment" from an imported file whose record says PDF and
 * whose bytes say web page would, opened in a frame, run as SchedulePlan with
 * the whole notebook in reach. Relabelled as a PDF it can only ever be a PDF,
 * or a PDF that fails to open. Never hand an unrelabelled object URL to an
 * iframe, a new tab or `window.open`; an `<img>` is the one place any bytes
 * are harmless, because an image cannot run script.
 */
export function useStoredFile(
  id: string | null,
  as?: string,
): { url: string | null; state: FileState } {
  const [url, setUrl] = useState<string | null>(null)
  const [state, setState] = useState<FileState>(id ? 'loading' : 'ready')

  useEffect(() => {
    if (!id) {
      setUrl(null)
      setState('ready')
      return
    }
    let live = true
    let created: string | null = null
    setState('loading')

    void readFile(id).then(
      (blob) => {
        if (!live) return
        if (!blob) {
          setState('missing')
          return
        }
        created = URL.createObjectURL(as ? new Blob([blob], { type: as }) : blob)
        setUrl(created)
        setState('ready')
      },
      () => live && setState('missing'),
    )

    return () => {
      live = false
      if (created) URL.revokeObjectURL(created)
      setUrl(null)
    }
  }, [id, as])

  return { url, state }
}

/**
 * An object URL for a stored blob, released when it is no longer on screen.
 *
 * Object URLs are a leak by default: the browser holds the blob alive until
 * the document is discarded or the URL is revoked by hand.
 */
export function useFileUrl(id: string | null, as?: string): string | null {
  return useStoredFile(id, as).url
}

/**
 * One photo: the tile, and its name under it.
 *
 * The name is on the page rather than in a `title`, because a tooltip needs a
 * pointer to hover and a phone has no pointer. It wraps to two lines and
 * breaks mid-word — file names have no spaces to break at, and a name that
 * overflows its tile drags the whole row out of line. Two lines is enough
 * here because the picture is what tells photos apart; a document has only
 * its name, and gets a `FileRow` instead.
 */
export function Thumb({ file, onOpen }: { file: Attachment; onOpen: () => void }) {
  const { url, state } = useStoredFile(file.id)

  return (
    <button
      type="button"
      onClick={onOpen}
      title={
        state === 'missing'
          ? tr(`${file.name} — not in this browser`, `${file.name} — 不在这个浏览器里`)
          : file.name
      }
      className="flex w-[72px] shrink-0 flex-col gap-1 text-left"
    >
      <span
        className={`relative block h-16 w-[72px] overflow-hidden rounded-xl border transition-colors ${
          state === 'missing'
            ? 'border-amber-300 bg-amber-50'
            : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300'
        }`}
      >
        {state === 'loading' ? (
          <span className="flex h-full w-full items-center justify-center">
            <Spinner className="h-4 w-4 text-neutral-300" />
          </span>
        ) : state === 'missing' ? (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-amber-700">
            <FileIcon className="h-5 w-5" />
            <span className="w-full truncate text-[9px] leading-none">{tr('missing', '缺失')}</span>
          </span>
        ) : url && isImage(file.type) ? (
          <img src={url} alt={file.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-neutral-400">
            <FileIcon className="h-6 w-6" />
          </span>
        )}
        {file.kind === 'scan' && state === 'ready' && (
          <span className="absolute bottom-0 inset-x-0 bg-neutral-900/70 py-0.5 text-center text-[9px] font-medium text-white">
            {tr('SCAN', '扫描')}
          </span>
        )}
      </span>

      <span
        className={`line-clamp-2 w-full break-all text-[10px] leading-[1.3] ${
          state === 'missing' ? 'text-amber-700' : 'text-neutral-500'
        }`}
      >
        {file.name}
      </span>
    </button>
  )
}

/** "PDF", "DOCX" — from the name, which says it better than a MIME type. */
function typeLabel(file: Attachment): string {
  const dot = file.name.lastIndexOf('.')
  if (dot > 0 && dot < file.name.length - 1) return file.name.slice(dot + 1).toUpperCase()
  return isPdf(file.type) ? 'PDF' : ''
}

/**
 * One document, as a row the width of the page with the whole name in it.
 *
 * Tickets for the same trip are named alike and differ at the end — "Cruise
 * Ticket 20224496 - Ms Tan", "Cruise Ticket 20224497 - Mr Chan" — and a 72px
 * tile cut both off at "Cruise Ticket 2022…", which is exactly the part they
 * share. A page icon cannot tell them apart either, so the name is the only
 * way to find the right one, and it is shown in full however long it runs.
 */
export function FileRow({ file, onOpen }: { file: Attachment; onOpen: () => void }) {
  const { state } = useStoredFile(file.id)
  const label = typeLabel(file)

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        state === 'missing'
          ? 'border-amber-300 bg-amber-50'
          : 'border-neutral-200 hover:bg-neutral-50'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          state === 'missing' ? 'text-amber-700' : 'bg-neutral-100 text-neutral-400'
        }`}
      >
        {state === 'loading' ? <Spinner className="h-4 w-4" /> : <FileIcon className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[14px] leading-5 [overflow-wrap:anywhere] ${
            state === 'missing' ? 'text-amber-800' : 'text-neutral-800'
          }`}
        >
          {file.name}
        </span>
        <span
          className={`block text-[12px] leading-4 ${
            state === 'missing' ? 'text-amber-700' : 'text-neutral-400'
          }`}
        >
          {state === 'missing'
            ? tr('Missing — not in this browser', '缺失——不在这个浏览器里')
            : [label, prettySize(file.size)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  )
}

/**
 * Every attachment of something: photos as a grid of pictures, then each
 * document on a line of its own. The one layout, used by the forms and the
 * detail sheets alike, so a file looks the same wherever it is found.
 */
export function AttachmentList({
  files,
  onOpen,
}: {
  files: Attachment[]
  onOpen: (file: Attachment) => void
}) {
  const photos = files.filter((file) => isImage(file.type))
  const documents = files.filter((file) => !isImage(file.type))

  return (
    <div className="flex flex-col gap-2">
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((file) => (
            <Thumb key={file.id} file={file} onOpen={() => onOpen(file)} />
          ))}
        </div>
      )}
      {documents.map((file) => (
        <FileRow key={file.id} file={file} onOpen={() => onOpen(file)} />
      ))}
    </div>
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

  /**
   * `chosen` is an array, and that is the whole bug fix.
   *
   * `input.files` is a **live** FileList: clearing `input.value` — which every
   * one of these handlers does, so that picking the same file twice still
   * fires a change — empties the very list the handler is holding. Reading it
   * afterwards found nothing, every time, which is why attaching had never
   * worked. Copy the files out first and the input can be reset freely.
   */
  async function take(chosen: File[], mode: 'file' | 'photo' | 'scan') {
    if (chosen.length === 0) return
    setBusy(true)
    const added: Attachment[] = []
    try {
      for (const file of chosen) {
        added.push(await saveFile(file, { scan: mode === 'scan' }))
      }
      onChange([...files, ...added])
    } catch (err) {
      onChange([...files, ...added])
      onError(
        err instanceof Error ? err.message : tr("That file couldn't be attached.", '这个文件没能添加。'),
      )
    } finally {
      setBusy(false)
    }
  }

  const button =
    'flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[13px] text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40'

  return (
    <div>
      {files.length > 0 && (
        <div className="mb-2.5">
          <AttachmentList files={files} onOpen={setViewing} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => pick.current?.click()} className={button}>
          {busy ? <Spinner className="h-3.5 w-3.5" /> : <PaperclipIcon className="h-3.5 w-3.5" />}
          {tr('Attach', '文件')}
        </button>
        <button type="button" disabled={busy} onClick={() => photo.current?.click()} className={button}>
          <CameraIcon className="h-3.5 w-3.5" />
          {tr('Photo', '拍照')}
        </button>
        <button type="button" disabled={busy} onClick={() => scan.current?.click()} className={button}>
          <ScanIcon className="h-3.5 w-3.5" />
          {tr('Scan', '扫描')}
        </button>
      </div>

      {/* Three inputs rather than one: `capture` is what makes a phone open
          the camera instead of the gallery, and it cannot be toggled per tap. */}
      {/* No `accept` on this one. A list of MIME types is a list of things
          the file dialog will refuse to show you, and the store keeps any
          blob — a .pptx, a .zip, a .heic — perfectly well. */}
      <input
        ref={pick}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const chosen = Array.from(event.target.files ?? [])
          event.target.value = ''
          void take(chosen, 'file')
        }}
      />
      <input
        ref={photo}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const chosen = Array.from(event.target.files ?? [])
          event.target.value = ''
          void take(chosen, 'photo')
        }}
      />
      <input
        ref={scan}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const chosen = Array.from(event.target.files ?? [])
          event.target.value = ''
          void take(chosen, 'scan')
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
  // A PDF's own URL is only ever saved, never opened — its pages are drawn
  // from the bytes (lib/pdf.ts). Relabelled all the same, so what is saved as
  // a PDF is one; see `useStoredFile`. Everything else goes in an <img>, is
  // read as text, or is only ever downloaded.
  const url = useFileUrl(file.id, isPdf(file.type) ? 'application/pdf' : undefined)
  const { pdf, failed } = usePdf(isPdf(file.type) ? file.id : null)
  // Page one, about as wide as the sheet, to say which document this is.
  const cover = usePageImage(pdf, 0, 480 * (window.devicePixelRatio || 1), true)
  const [full, setFull] = useState(false)
  const [reading, setReading] = useState<OcrProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const canEnlarge = isImage(file.type) ? Boolean(url) : Boolean(pdf)

  // A text file is worth showing as text. Capped: a 20MB CSV pasted whole
  // into a sheet would take the sheet with it.
  useEffect(() => {
    if (!url || !isText(file.type)) return
    let live = true
    void fetch(url)
      .then((response) => response.text())
      .then((text) => live && setPreview(text.slice(0, 4000)))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [url, file.type])

  async function read() {
    setError(null)
    setReading({ status: tr('Starting', '准备中'), progress: 0 })
    try {
      const blob = await readFile(file.id)
      if (!blob) {
        throw new Error(
          tr('That attachment is missing from this browser.', '这个浏览器里找不到这个附件。'),
        )
      }
      const text = await readText(blob, setReading)
      onText?.(text.trim() || '')
      if (!text.trim()) {
        setError(tr('No text could be made out in that image.', '这张图片里认不出文字。'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("That image couldn't be read.", '这张图片读不了。'))
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

  // The badge that says the picture opens: on a phone there is no pointer
  // to change shape over it, and nothing else would say so.
  const enlarge = (
    <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-neutral-900/75 px-2.5 py-1 text-[12px] font-medium text-white">
      <ZoomIcon className="h-3.5 w-3.5" />
      {tr('Tap to enlarge', '点开看大图')}
    </span>
  )

  return (
    <Sheet onClose={onClose} title={file.name}>
      {/* Show the thing, not a description of it, wherever the browser can
          render it. Only formats nothing can display fall back to the chip. */}
      {isPdf(file.type) && failed ? (
        <div className="flex items-center gap-3 rounded-xl bg-neutral-50 px-4 py-5">
          <FileIcon className="h-7 w-7 text-neutral-400" />
          <p className="text-[14px] text-neutral-500">
            {tr(
              "This PDF can't be shown here. Save a copy to open it.",
              '这里显示不了这个 PDF，保存副本后再打开。',
            )}
          </p>
        </div>
      ) : !url || (isPdf(file.type) && !cover) ? (
        <div className="flex h-40 items-center justify-center rounded-xl bg-neutral-50">
          <Spinner className="h-5 w-5 text-neutral-300" />
        </div>
      ) : isImage(file.type) ? (
        <button type="button" onClick={() => setFull(true)} className="relative block w-full">
          <img
            src={url}
            alt={file.name}
            className="max-h-[46vh] w-full rounded-xl border border-neutral-100 object-contain"
          />
          {enlarge}
        </button>
      ) : isPdf(file.type) && cover ? (
        <button
          type="button"
          onClick={() => setFull(true)}
          className="relative block w-full rounded-xl border border-neutral-100 bg-neutral-50 p-3"
        >
          <img
            src={cover}
            alt={file.name}
            className="mx-auto max-h-[42vh] bg-white object-contain shadow-sm ring-1 ring-black/5"
          />
          {enlarge}
        </button>
      ) : isText(file.type) ? (
        <pre className="max-h-[46vh] overflow-auto whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-[12px] leading-5 text-neutral-700">
          {preview ?? ' '}
        </pre>
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
        {pdf && pdf.pages > 1 && tr(` · ${pdf.pages} pages`, ` · ${pdf.pages} 页`)}
        {file.kind === 'scan' && tr(' · scanned', ' · 已扫描')}
      </p>

      {file.text && (
        <div className="mt-3">
          <p className="pb-1 text-[13px] font-medium text-neutral-400">
            {tr('Text read from it', '识别出的文字')}
          </p>
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
        {canEnlarge && (
          <button
            type="button"
            onClick={() => setFull(true)}
            className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2.5 text-[14px] font-medium text-white"
          >
            <ZoomIcon className="h-4 w-4" />
            {tr('Full screen', '全屏查看')}
          </button>
        )}
        {onText && isImage(file.type) && (
          <button
            type="button"
            onClick={read}
            disabled={Boolean(reading)}
            className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-2.5 text-[14px] font-medium disabled:opacity-40"
          >
            <ScanIcon className="h-4 w-4" />
            {file.text ? tr('Read again', '重新识别') : tr('Read text', '识别文字')}
          </button>
        )}
        <button
          type="button"
          onClick={download}
          disabled={!url}
          className="rounded-full border border-neutral-200 px-4 py-2.5 text-[14px] font-medium disabled:opacity-40"
        >
          {tr('Save a copy', '保存副本')}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-2.5 text-[14px] font-medium text-red-600"
          >
            <TrashIcon />
            {tr('Remove', '移除')}
          </button>
        )}
      </div>

      {/* Drawn on the body through a portal, so being written in here
          does not put it inside the sheet. */}
      {full && canEnlarge && (
        <FullView
          name={file.name}
          pdf={pdf}
          image={isImage(file.type) ? url : null}
          onClose={() => setFull(false)}
        />
      )}
    </Sheet>
  )
}

export default AttachmentStrip
