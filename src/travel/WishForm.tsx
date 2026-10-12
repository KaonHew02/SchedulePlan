import { useMemo, useRef, useState, type FormEvent } from 'react'
import AttachmentStrip, { useFileUrl } from '../components/Attachments'
import CountrySelect from '../components/CountrySelect'
import { Field, NotesField, TextField } from '../components/FormFields'
import { CameraIcon, CheckIcon, Spinner, TrashIcon } from '../components/Icons'
import LinkEditor from '../components/LinkEditor'
import Sheet from '../components/Sheet'
import { saveFile } from '../lib/files'
import { tr } from '../lib/i18n'
import { typedBefore } from '../lib/places'
import { deleteWish, placesOf, saveWish, useSchedule, useWishlist } from '../lib/store'
import type { Attachment, TripLink, WishPlace } from '../types'

const FORM_ID = 'wish-form'

/**
 * Somewhere you want to go, with a picture to remember why — and the rest of
 * what you found out while you were looking it up.
 *
 * A wish is where a trip starts, so it collects what a trip collects: a note
 * to write in, the booking page and the video, the brochure somebody sent.
 * Holding them anywhere else means keeping the research and the place it is
 * about in two apps until the day you go.
 */
export default function WishForm({
  wish,
  onClose,
  onSaved,
  onBeenThere,
}: {
  wish: WishPlace | null
  onClose: () => void
  onSaved: (message: string) => void
  /**
   * Hand this place over to the schedule, where having been somewhere is
   * recorded. There is no "visited" flag on a wish, and adding one would
   * invent a second kind of place record — the counters, the globe and the
   * trip list all read schedule items, so a visited wish has to become one.
   */
  onBeenThere?: (wish: WishPlace) => void
}) {
  const photoInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(wish?.name ?? '')
  const [country, setCountry] = useState<string | null>(wish?.country ?? null)
  const [region, setRegion] = useState(wish?.region ?? '')
  // A region belongs to its country, so a new country starts without one.
  const pickCountry = (next: string | null) => {
    if (next !== country) setRegion('')
    setCountry(next)
  }
  const [note, setNote] = useState(wish?.note ?? '')
  const [photo, setPhoto] = useState<Attachment | null>(wish?.photo ?? null)
  const [files, setFiles] = useState<Attachment[]>(wish?.attachments ?? [])
  const [links, setLinks] = useState<TripLink[]>(wish?.links ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = useFileUrl(photo?.id ?? null)
  const schedule = useSchedule()
  const wishlist = useWishlist()
  const regions = useMemo(
    () => (country ? typedBefore([...placesOf(schedule), ...wishlist], country).regions : []),
    [schedule, wishlist, country],
  )

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveWish({
        id: wish?.id,
        name,
        country: country ?? '',
        region: region || null,
        note: note || null,
        photo,
        attachments: files,
        links,
      })
      onSaved(wish ? tr('Updated', '已更新') : tr('Added to the wishlist', '已加入心愿单'))
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Could not save that.', '没能保存。'))
      setBusy(false)
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title={wish ? tr('Edit place', '编辑地点') : tr('Somewhere to go', '想去的地方')}
      footer={
        <>
          {error && <p className="mb-2.5 text-[13px] text-red-600">{error}</p>}
          <button
            type="submit"
            form={FORM_ID}
            disabled={busy}
            className="w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white disabled:opacity-40"
          >
            {busy ? tr('Saving...', '正在保存…') : tr('Save', '保存')}
          </button>
          {wish && (
            <button
              type="button"
              onClick={() => {
                void deleteWish(wish.id).then(() => onSaved(tr('Removed', '已移除')))
              }}
              className="mt-2 w-full rounded-full border border-neutral-200 py-3 text-[15px] font-medium text-red-600"
            >
              {tr('Remove', '移除')}
            </button>
          )}
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus={!wish}
          placeholder={tr('Where do you want to go?', '想去哪里？')}
          className="w-full bg-transparent py-1 text-[17px] outline-hidden placeholder:text-neutral-300"
        />

        <div className="mt-2 divide-y divide-neutral-100 border-y border-neutral-100">
          <Field label={tr('Country', '国家')}>
            <CountrySelect value={country} onChange={pickCountry} />
          </Field>
          {country && (
            <Field label={tr('Region', '地区')} hint={tr('地区, like 海南 or Sabah', '比如海南、沙巴')}>
              <TextField
                label={tr('Region', '地区')}
                value={region}
                onChange={setRegion}
                suggestions={regions}
              />
            </Field>
          )}
          {/*
            Why used to be a line on the right of a label, which is a stamp to
            write on: "Culture, Ice Cream, Dessert," was already running off
            the end of it. The reason you want to go is the first sentence of
            everything else you look up about the place, so it gets the box
            that grows — the same one the schedule and the expenses write in.
          */}
          <div className="py-3">
            <NotesField
              value={note}
              onChange={setNote}
              placeholder={tr(
                'Why you want to go — and anything worth keeping',
                '为什么想去，还有值得记下的一切',
              )}
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="pb-2 text-[13px] text-neutral-400">
            {tr('Picture', '图片')}{' '}
            <span className="text-neutral-300">{tr('· the one on the card', '· 卡片上显示的那张')}</span>
          </p>
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt={name || tr('Wishlist place', '心愿单地点')}
                className="h-40 w-full rounded-2xl object-cover"
              />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                aria-label={tr('Remove the picture', '移除图片')}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-red-600 shadow-sm"
              >
                <TrashIcon />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => photoInput.current?.click()}
              className="flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-neutral-200 py-8 text-neutral-400 transition-colors hover:border-neutral-300"
            >
              {busy ? <Spinner className="h-5 w-5" /> : <CameraIcon className="h-6 w-6" />}
              <span className="text-[13px] font-medium">{tr('Add a picture', '添加图片')}</span>
            </button>
          )}
        </div>

        {/*
          Links before files, as in the schedule form: one is usually why the
          other is not there. Half of wanting to go somewhere lives on
          somebody else's server — the video that put the idea there, the
          hotel page, the map pin — and pasting the address is the whole of
          keeping it.
        */}
        <div className="mt-4">
          <LinkEditor links={links} onChange={setLinks} />
        </div>

        <div className="mt-4">
          <p className="pb-2 text-[13px] text-neutral-400">{tr('Attachments', '附件')}</p>
          <AttachmentStrip files={files} onChange={setFiles} onError={setError} />
        </div>

        {wish && onBeenThere && (
          <>
            <button
              type="button"
              onClick={() => onBeenThere(wish)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 py-3 text-[14px] font-medium text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700"
            >
              <CheckIcon className="h-4 w-4" />
              {tr('I have been here', '我去过这里')}
            </button>
            <p className="pt-2 text-[12px] leading-5 text-neutral-400">
              {tr(
                'Puts it in the schedule as a trip — with the country, so it counts — and takes it off the wishlist. The note, the links and the files go with it.',
                '把它作为行程放进日程（带上国家，才会计数），并从心愿单移除。备注、链接和文件都会一起带过去。',
              )}
            </p>
          </>
        )}

        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            setBusy(true)
            saveFile(file)
              .then(setPhoto)
              .catch((err: unknown) =>
                setError(
                  err instanceof Error ? err.message : tr("That picture couldn't be used.", '这张图片用不了。'),
                ),
              )
              .finally(() => setBusy(false))
          }}
        />
      </form>
    </Sheet>
  )
}
