import { useRef, useState } from 'react'
import { useFileUrl } from '../components/Attachments'
import { DateField, TimeField } from '../components/FormFields'
import { CameraIcon, CheckIcon, ScanIcon, Spinner } from '../components/Icons'
import { ChevronLeft } from '../components/Icons'
import { todayISO } from '../lib/date'
import { readFile, saveBlob, scanFilter } from '../lib/files'
import { parseItinerary, readText, type ItineraryDraft, type OcrProgress } from '../lib/ocr'
import { store } from '../lib/store'
import { tr } from '../lib/i18n'
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
 *
 * Text can also be pasted in instead of photographed. Handwriting is beyond
 * the reader here, but not beyond the phone: an iPhone's Scan Text reads a
 * page straight into the box, Android's camera copies text off one, and what
 * they give goes through the same parser as a scan — keeping the steps with no
 * time of their own as the notes of their day.
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
  const [pasted, setPasted] = useState('')
  const [fromPaste, setFromPaste] = useState(false)
  const preview = useFileUrl(attachment?.id ?? null)

  async function handle(file: File) {
    setError(null)
    setRows([])
    setText('')
    setAttachment(null)
    setFromPaste(false)
    setProgress({ status: tr('Flattening the page', '正在处理页面'), progress: 0 })

    let saved: Attachment
    try {
      const flattened = await scanFilter(file)
      saved = await saveBlob(flattened, file.name || 'Scan', 'scan')
      setAttachment(saved)
    } catch (err) {
      setProgress(null)
      setError(
        err instanceof Error ? err.message : tr("That page couldn't be prepared.", '这一页没能处理好。'),
      )
      return
    }

    try {
      const blob = await readFile(saved.id)
      const found = await readText(blob ?? file, setProgress)
      setText(found)
      setAttachment({ ...saved, text: found.trim() || null })
      const drafts = parseItinerary(found, todayISO())
      setRows(drafts.map((draft, index) => ({ ...draft, key: index, keep: true })))
      if (!found.trim()) setError(tr('No text could be made out on that page.', '这一页上认不出文字。'))
      else if (drafts.length === 0) {
        setError(
          tr(
            "Text was read, but nothing in it looked like a dated appointment. If the page is handwritten, this reader can't read it: tap Paste text instead, and let your iPhone's Scan Text read it.",
            '读出了文字，但里面没有像带日期的安排。如果是手写的，这个识别器认不出来：请点「改为粘贴文字」，让 iPhone 的「扫描文本」来读。',
          ),
        )
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tr("That page couldn't be read. The scan is kept.", '这一页没能读出来，扫描件已保留。'),
      )
    } finally {
      setProgress(null)
    }
  }

  function readPasted() {
    const found = pasted.trim()
    if (!found) return
    // Pasted text is what someone chose to keep, so the steps without times
    // are kept too, as the notes of their day.
    const drafts = parseItinerary(found, todayISO(), { notes: true })
    setAttachment(null)
    setText(found)
    setFromPaste(true)
    setRows(drafts.map((draft, index) => ({ ...draft, key: index, keep: true })))
    setError(
      drafts.length === 0
        ? tr(
            'Nothing in that has a date or a time to go by. Add a line with the date, like 2/10/2026, and try again.',
            '里面没有可以参照的日期或时间。加一行日期，比如 2/10/2026，再试一次。',
          )
        : null,
    )
  }

  /** Back to the start, with whatever was pasted still in the box. */
  function startOver() {
    setAttachment(null)
    setFromPaste(false)
    setText('')
    setRows([])
    setError(null)
  }

  function edit(key: number, patch: Partial<Row>) {
    setRows((was) => was.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  async function addChosen() {
    const chosen = rows.filter((row) => row.keep)
    if (chosen.length === 0) return
    // Checked before anything is written: a row that fails halfway down the
    // list would leave the ones above it saved, and a second try would add
    // them twice.
    if (chosen.some((row) => !row.title.trim())) {
      setError(tr('Every ticked row needs a title.', '每一条勾选的都要有标题。'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      for (const [index, row] of chosen.entries()) {
        await store.createSchedule({
          date: row.date,
          end_date: null,
          all_day: !row.start_time,
          start_time: row.start_time ?? '00:00',
          // A start moved past the end on this screen makes the end meaningless.
          end_time:
            row.start_time && row.end_time && row.end_time > row.start_time ? row.end_time : null,
          title: row.title,
          location: row.location,
          notes: row.notes?.trim() || null,
          tag: null,
          place: null,
          // The page itself goes with the first item only. Pointing several
          // records at one blob would mean deleting any of them takes the
          // scan away from the rest.
          attachments: index === 0 && attachment ? [attachment] : [],
        })
      }
      onToast(tr(`Added ${chosen.length} to the schedule`, `已把 ${chosen.length} 项加入日程`))
      onBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Could not add those.', '没能添加。'))
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
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-1 px-3 pb-3 pt-4 lg:px-6">
          <button
            onClick={onBack}
            aria-label={tr('Back to More', '返回「更多」')}
            className="p-1.5 text-neutral-400"
          >
            <ChevronLeft />
          </button>
          <h1 className="text-[19px] font-semibold tracking-tight">
            {tr('Document scanner', '文档扫描')}
          </h1>
        </div>
      </header>

      <main className="px-5 pb-28 lg:max-w-2xl lg:px-8 lg:pb-10">
        {!attachment && !fromPaste && !progress && (
          <>
            <p className="pb-4 pt-1 text-[14px] leading-6 text-neutral-500">
              {tr(
                'Photograph a booking, an itinerary or any printed page. It is straightened and read on this device — nothing is uploaded, and no account is involved.',
                '拍下预订单、行程单或任何印刷的页面。整理和识别都在这台设备上完成——不上传任何内容，也不用登录账号。',
              )}
            </p>
            <button
              onClick={() => input.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 py-12 text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-500"
            >
              <CameraIcon className="h-8 w-8" />
              <span className="text-[14px] font-medium">
                {tr('Take or choose a photo', '拍照或选择照片')}
              </span>
            </button>
            <p className="pt-3 text-[12px] leading-5 text-neutral-400">
              {tr(
                'It reads printed English and Chinese. The reader is a ~14 MB download the first time, then it stays for the session.',
                '能识别印刷的英文和中文。第一次要下载约 14 MB 的识别器，之后这次打开期间都不用再下载。',
              )}
            </p>

            <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400">
              {tr('Handwritten? Scan or paste the text', '手写的？扫描或粘贴文字')}
            </h2>
            <textarea
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              rows={5}
              placeholder={tr(
                '2 Oct 2026\n10:00 Check in at Marina Bay Cruise Centre\n13:00 Muster drill',
                '2026年10月2日\n10:00 在滨海湾邮轮中心办理登船\n13:00 救生演习',
              )}
              aria-label={tr('Text to look for appointments in', '要从中找出安排的文字')}
              className="w-full resize-y rounded-2xl border border-neutral-200 p-4 text-[15px] leading-6 outline-hidden transition-colors focus:border-brand-300 placeholder:text-neutral-300"
            />
            <p className="pt-1.5 text-[12px] leading-5 text-neutral-400">
              {tr(
                'Tap the box, choose Scan Text (on newer iPhones it is under AutoFill), point the camera at the page and tap Insert. Your iPhone reads it itself, handwriting included, so nothing is uploaded. Steps without a time go into the notes of their day.',
                '点一下输入框，选「扫描文本」（较新的 iPhone 在「自动填充」里），把相机对准页面，再点「插入」。iPhone 自己就能识别，手写的也行，所以什么都不会上传。没有时间的步骤会放进当天的备注。',
              )}
            </p>
            <button
              onClick={readPasted}
              disabled={!pasted.trim()}
              className="mt-3 w-full rounded-full border border-neutral-200 py-2.5 text-[15px] font-medium disabled:opacity-40"
            >
              {tr('Find appointments', '找出安排')}
            </button>
          </>
        )}

        {progress && (
          <div className="py-14 text-center">
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

        {(attachment || fromPaste) && !progress && (
          <>
            {attachment ? (
              <div className="flex gap-3">
                {preview && (
                  <img
                    src={preview}
                    alt={tr('The scanned page', '扫描的页面')}
                    className="h-32 w-24 shrink-0 rounded-xl border border-neutral-200 object-cover"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <button
                    onClick={download}
                    className="rounded-full border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-neutral-600"
                  >
                    {tr('Save the scan', '保存扫描件')}
                  </button>
                  <button
                    onClick={() => input.current?.click()}
                    className="flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[13px] text-neutral-600"
                  >
                    <ScanIcon className="h-3.5 w-3.5" />
                    {tr('Scan another', '再扫一页')}
                  </button>
                  <button
                    onClick={startOver}
                    className="rounded-full border border-neutral-200 px-3 py-1.5 text-[13px] text-neutral-600"
                  >
                    {tr('Paste text instead', '改为粘贴文字')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="min-w-0 flex-1 text-[14px] text-neutral-500">
                  {tr('From the text you pasted', '来自你粘贴的文字')}
                </p>
                <button
                  onClick={startOver}
                  className="rounded-full border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-neutral-600"
                >
                  {tr('Edit the text', '修改文字')}
                </button>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-800">
                {error}
              </p>
            )}

            {rows.length > 0 && (
              <>
                <div className="flex items-baseline justify-between pb-1 pt-6">
                  <h2 className="text-[13px] font-medium text-neutral-400">
                    {tr(
                      <>
                        Found {rows.length} {rows.length === 1 ? 'thing' : 'things'}
                      </>,
                      <>找到 {rows.length} 项</>,
                    )}
                  </h2>
                  <button
                    onClick={() =>
                      setRows((was) => {
                        const allOn = was.every((row) => row.keep)
                        return was.map((row) => ({ ...row, keep: !allOn }))
                      })
                    }
                    className="text-[13px] font-medium text-brand-500"
                  >
                    {rows.every((row) => row.keep)
                      ? tr('Untick all', '全部取消')
                      : tr('Tick all', '全选')}
                  </button>
                </div>

                <div className="divide-y divide-neutral-100 border-y border-neutral-100">
                  {rows.map((row) => (
                    <div key={row.key} className="flex gap-3 py-3">
                      <button
                        onClick={() => edit(row.key, { keep: !row.keep })}
                        aria-label={
                          row.keep ? tr('Do not add this', '不添加这一项') : tr('Add this', '添加这一项')
                        }
                        aria-pressed={row.keep}
                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          row.keep ? 'border-brand-500 bg-brand-500 text-white' : 'border-neutral-300'
                        }`}
                      >
                        {row.keep && <CheckIcon className="h-3 w-3" />}
                      </button>

                      <div className={`min-w-0 flex-1 ${row.keep ? '' : 'opacity-40'}`}>
                        <input
                          value={row.title}
                          onChange={(event) => edit(row.key, { title: event.target.value })}
                          aria-label={tr('What it is', '事项')}
                          className="w-full bg-transparent text-[15px] outline-hidden"
                        />
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <DateField
                            value={row.date}
                            onChange={(date) => edit(row.key, { date })}
                            label={tr('Date', '日期')}
                          />
                          <TimeField
                            label={tr('Start', '开始')}
                            value={row.start_time ?? ''}
                            onChange={(time) => edit(row.key, { start_time: time || null })}
                            placeholder={tr('All day', '全天')}
                            clearable
                          />
                        </div>
                        {row.location && (
                          <p className="mt-1 truncate text-[12px] text-neutral-400">
                            {row.location}
                          </p>
                        )}
                        {row.notes !== null && (
                          <textarea
                            value={row.notes}
                            onChange={(event) => edit(row.key, { notes: event.target.value })}
                            rows={Math.min(8, row.notes.split('\n').length)}
                            aria-label={tr('Notes', '备注')}
                            className="mt-1.5 w-full resize-y rounded-lg bg-neutral-50 px-2.5 py-1.5 text-[13px] leading-5 text-neutral-600 outline-hidden"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addChosen}
                  disabled={chosenCount === 0 || saving}
                  className="mt-5 w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white disabled:opacity-40"
                >
                  {saving
                    ? tr('Adding...', '正在添加…')
                    : chosenCount === 0
                      ? tr('Nothing ticked', '没有勾选')
                      : tr(`Add ${chosenCount} to the schedule`, `把 ${chosenCount} 项加入日程`)}
                </button>
                <p className="pt-2 text-[12px] leading-5 text-neutral-400">
                  {fromPaste
                    ? tr(
                        'Check each date and time first — a line with no date above it goes on today.',
                        '先检查每个日期和时间——上面没有日期的行会放在今天。',
                      )
                    : tr(
                        'Check each date and time first — a reader working off a photo gets them wrong often enough to matter. The scan itself is kept with the first one.',
                        '先检查每个日期和时间——从照片识别，认错的时候不少。扫描件会跟第一项存在一起。',
                      )}
                </p>
              </>
            )}

            {text && !fromPaste && (
              <details className="mt-6">
                <summary className="cursor-pointer text-[13px] text-neutral-400">
                  {tr('All the text it read', '识别出的全部文字')}
                </summary>
                <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-[12px] leading-5 text-neutral-600">
                  {text}
                </p>
                <button
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(text)
                      .then(() => onToast(tr('Text copied', '已复制文字')))
                  }}
                  className="mt-2 rounded-full border border-neutral-200 px-3 py-1.5 text-[13px] text-neutral-600"
                >
                  {tr('Copy the text', '复制文字')}
                </button>
              </details>
            )}
          </>
        )}

        {!attachment && !fromPaste && error && (
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
