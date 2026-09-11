import { useRef, useState, type FormEvent } from 'react'
import { useFileUrl } from '../components/Attachments'
import CountrySelect from '../components/CountrySelect'
import { Field, TextField } from '../components/FormFields'
import { CameraIcon, CheckIcon, Spinner, TrashIcon } from '../components/Icons'
import Sheet from '../components/Sheet'
import { saveFile } from '../lib/files'
import { deleteWish, saveWish } from '../lib/store'
import type { Attachment, WishPlace } from '../types'

const FORM_ID = 'wish-form'

/** Somewhere you want to go, with a picture to remember why. */
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
  const [note, setNote] = useState(wish?.note ?? '')
  const [photo, setPhoto] = useState<Attachment | null>(wish?.photo ?? null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = useFileUrl(photo?.id ?? null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveWish({ id: wish?.id, name, country: country ?? '', note: note || null, photo })
      onSaved(wish ? 'Updated' : 'Added to the wishlist')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.')
      setBusy(false)
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title={wish ? 'Edit place' : 'Somewhere to go'}
      footer={
        <>
          {error && <p className="mb-2.5 text-[13px] text-red-600">{error}</p>}
          <button
            type="submit"
            form={FORM_ID}
            disabled={busy}
            className="w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white disabled:opacity-40"
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
          {wish &&
            (confirming ? (
              <button
                type="button"
                onClick={() => {
                  void deleteWish(wish.id).then(() => onSaved('Removed'))
                }}
                className="mt-2 w-full rounded-full bg-red-600 py-3 text-[15px] font-medium text-white"
              >
                Tap to confirm
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="mt-2 w-full rounded-full border border-neutral-200 py-3 text-[15px] font-medium text-red-600"
              >
                Remove
              </button>
            ))}
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus={!wish}
          placeholder="Where do you want to go?"
          className="w-full bg-transparent py-1 text-[17px] outline-none placeholder:text-neutral-300"
        />

        <div className="mt-2 divide-y divide-neutral-100 border-y border-neutral-100">
          <Field label="Country">
            <CountrySelect value={country} onChange={setCountry} />
          </Field>
          <Field label="Why">
            <TextField label="Note" value={note} onChange={setNote} />
          </Field>
        </div>

        <div className="mt-4">
          <p className="pb-2 text-[13px] text-neutral-400">Picture</p>
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt={name || 'Wishlist place'}
                className="h-40 w-full rounded-2xl object-cover"
              />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                aria-label="Remove the picture"
                className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-red-600 shadow"
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
              <span className="text-[13px] font-medium">Add a picture</span>
            </button>
          )}
        </div>

        {wish && onBeenThere && (
          <>
            <button
              type="button"
              onClick={() => onBeenThere(wish)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 py-3 text-[14px] font-medium text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700"
            >
              <CheckIcon className="h-4 w-4" />
              I have been here
            </button>
            <p className="pt-2 text-[12px] leading-5 text-neutral-400">
              Puts it in the schedule as a trip — with the country, so it counts — and takes it
              off the wishlist. The picture goes with it.
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
                setError(err instanceof Error ? err.message : "That picture couldn't be used."),
              )
              .finally(() => setBusy(false))
          }}
        />
      </form>
    </Sheet>
  )
}
