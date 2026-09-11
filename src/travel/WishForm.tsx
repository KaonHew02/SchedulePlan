import { useRef, useState, type FormEvent } from 'react'
import { useFileUrl } from '../components/Attachments'
import CountrySelect from '../components/CountrySelect'
import { Field, TextField } from '../components/FormFields'
import { CameraIcon, Spinner, TrashIcon } from '../components/Icons'
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
}: {
  wish: WishPlace | null
  onClose: () => void
  onSaved: (message: string) => void
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
