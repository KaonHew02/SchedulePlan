import { useRef, useState, type FormEvent } from 'react'
import { useFileUrl } from '../components/Attachments'
import Flag from '../components/Flag'
import { DateField, Field, NotesField, Toggle } from '../components/FormFields'
import { CameraIcon, Close, PinIcon, Spinner } from '../components/Icons'
import Sheet from '../components/Sheet'
import { todayISO } from '../lib/date'
import { saveFile } from '../lib/files'
import { tr } from '../lib/i18n'
import { countryName } from '../lib/places'
import { deleteMemory, saveMemory } from '../lib/store'
import { searchMap, type MapPlace } from '../seasons/where'
import type { Attachment, Memory, MemoryKind, MemoryPlace } from '../types'
import { KINDS, KindGlyph, kindLabel } from './kinds'
import { placeAt, readPhotoInfo } from './photoInfo'

const FORM_ID = 'memory-form'
/** Enough for a day out; a memory is a moment, not an album. */
const MAX_PHOTOS = 12

function PhotoTile({
  file,
  cover,
  onCover,
  onRemove,
}: {
  file: Attachment
  cover: boolean
  onCover: () => void
  onRemove: () => void
}) {
  const url = useFileUrl(file.type.startsWith('image/') ? file.id : null)
  return (
    <div className={`relative aspect-square overflow-hidden rounded-xl bg-neutral-100 ${cover ? 'ring-2 ring-brand-500' : ''}`}>
      {url ? (
        <img src={url} alt={file.name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center p-1 text-center text-[11px] text-neutral-400">{file.name}</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={tr('Remove this photo', '移除这张照片')}
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
      >
        <Close className="h-3.5 w-3.5" />
      </button>
      {cover ? (
        <span className="absolute bottom-1 left-1 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {tr('Cover', '封面')}
        </span>
      ) : (
        <button
          type="button"
          onClick={onCover}
          className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white"
        >
          {tr('Make cover', '设为封面')}
        </button>
      )}
    </div>
  )
}

/**
 * Write a memory down, or change one.
 *
 * Photos first, because they are usually what a memory starts from — and a
 * photo can fill in the day, and sometimes the place, by itself. The place is
 * looked up on OpenStreetMap (the same search Seasons uses) so it lands on the
 * map; a name typed and not looked up is kept as just a name.
 */
export default function MemoryForm({
  memory,
  onClose,
  onSaved,
}: {
  memory: Memory | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(memory?.title ?? '')
  const [date, setDate] = useState(memory?.date ?? todayISO())
  // A photo's date fills the day only until somebody picks one themselves.
  const dateChosen = useRef(Boolean(memory))
  const [kind, setKind] = useState<MemoryKind>(memory?.kind ?? 'everyday')
  const [favorite, setFavorite] = useState(memory?.favorite ?? false)
  const [photos, setPhotos] = useState<Attachment[]>(memory?.photos ?? [])
  const [place, setPlaceState] = useState<MemoryPlace | null>(memory?.place ?? null)
  // Read by the photo loop, which runs across renders and must see the latest.
  const placeNow = useRef<MemoryPlace | null>(memory?.place ?? null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MapPlace[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [story, setStory] = useState(memory?.story ?? '')
  const [tags, setTags] = useState((memory?.tags ?? []).join(', '))
  const [adding, setAdding] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filledIn, setFilledIn] = useState<string | null>(null)

  const setPlace = (next: MemoryPlace | null) => {
    placeNow.current = next
    setPlaceState(next)
  }

  async function addPhotos(files: File[]) {
    setError(null)
    const room = MAX_PHOTOS - photos.length - adding
    if (room <= 0) {
      setError(tr(`A memory holds up to ${MAX_PHOTOS} photos.`, `一段回忆最多放 ${MAX_PHOTOS} 张照片。`))
      return
    }
    const take = files.slice(0, room)
    if (files.length > room) {
      setError(tr(`Added ${room}. A memory holds up to ${MAX_PHOTOS} photos.`, `加了 ${room} 张。一段回忆最多放 ${MAX_PHOTOS} 张照片。`))
    }
    setAdding((count) => count + take.length)
    let gotDate = false
    let gotPlace = false
    for (const file of take) {
      try {
        // Before saving: the shrunk copy keeps the picture, not the date and place in it.
        const info = await readPhotoInfo(file)
        const saved = await saveFile(file)
        setPhotos((list) => [...list, saved])
        if (info.date && !dateChosen.current) {
          dateChosen.current = true
          setDate(info.date)
          gotDate = true
        }
        if (info.lat !== null && info.lon !== null && !placeNow.current) {
          const point: MemoryPlace = { name: '', country: null, lat: info.lat, lon: info.lon }
          setPlace(point)
          gotPlace = true
          void placeAt(info.lat, info.lon).then((found) => {
            if (found && placeNow.current === point) setPlace({ ...point, name: found.name, country: found.country })
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : tr("That photo couldn't be used.", '这张照片用不了。'))
      } finally {
        setAdding((count) => count - 1)
      }
    }
    if (gotDate || gotPlace) {
      setFilledIn(
        gotDate && gotPlace
          ? tr('The day and the place came from your photo. Change them if they are off.', '日期和地点取自照片，如有不对可以改。')
          : gotDate
            ? tr('The day came from your photo. Change it if it is off.', '日期取自照片，如有不对可以改。')
            : tr('The place came from your photo. Change it if it is off.', '地点取自照片，如有不对可以改。'),
      )
    }
  }

  async function search() {
    const text = query.trim()
    if (text.length < 2) return
    setSearching(true)
    setError(null)
    try {
      setResults(await searchMap(text))
    } catch {
      setError(
        tr(
          "Couldn't search just now. Check the connection, or keep the name as typed.",
          '暂时搜索不了。请检查网络，或者直接用输入的名字。',
        ),
      )
    } finally {
      setSearching(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (adding > 0) {
      setError(tr('Wait for the photos to finish.', '请等照片加完。'))
      return
    }
    setBusy(true)
    setError(null)
    // A name typed and never looked up is still the place's name.
    const typed = query.trim()
    const finalPlace = place ?? (typed ? { name: typed, country: null, lat: null, lon: null } : null)
    try {
      await saveMemory({
        id: memory?.id,
        title,
        date,
        kind,
        story: story || null,
        tags: tags.split(/[,，、]/),
        place: finalPlace,
        photos,
        favorite,
      })
      onSaved(memory ? tr('Saved', '已保存') : tr('Memory kept', '回忆已保存'))
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Could not save that.', '没能保存。'))
      setBusy(false)
    }
  }

  const point = place && place.lat !== null && place.lon !== null

  return (
    <Sheet
      onClose={onClose}
      title={memory ? tr('Edit memory', '编辑回忆') : tr('New memory', '新回忆')}
      footer={
        <>
          {error && <p className="mb-2.5 text-[13px] text-red-600">{error}</p>}
          <button
            type="submit"
            form={FORM_ID}
            disabled={busy || adding > 0}
            className="w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white disabled:opacity-40"
          >
            {busy ? tr('Saving...', '正在保存…') : adding > 0 ? tr('Adding photos...', '正在加照片…') : tr('Save', '保存')}
          </button>
          {memory && (
            <button
              type="button"
              onClick={() => {
                void deleteMemory(memory.id).then(() => onSaved(tr('Deleted', '已删除')))
              }}
              className="mt-2 w-full rounded-full border border-neutral-200 py-3 text-[15px] font-medium text-red-600"
            >
              {tr('Delete', '删除')}
            </button>
          )}
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus={!memory}
          maxLength={140}
          placeholder={tr('What do you want to remember?', '想记住什么？')}
          className="w-full bg-transparent py-1 text-[17px] outline-hidden placeholder:text-neutral-300"
        />

        <div className="mt-3">
          <p className="pb-2 text-[13px] text-neutral-400">
            {tr('Photos', '照片')}{' '}
            <span className="text-neutral-300">{tr('· the first is the cover', '· 第一张是封面')}</span>
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {photos.map((file, index) => (
              <PhotoTile
                key={file.id}
                file={file}
                cover={index === 0}
                onCover={() => setPhotos((list) => [file, ...list.filter((other) => other.id !== file.id)])}
                onRemove={() => setPhotos((list) => list.filter((other) => other.id !== file.id))}
              />
            ))}
            {Array.from({ length: adding }, (_, index) => (
              <div key={`adding-${index}`} className="flex aspect-square items-center justify-center rounded-xl bg-neutral-100">
                <Spinner className="h-5 w-5 text-neutral-400" />
              </div>
            ))}
            {photos.length + adding < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-200 text-neutral-400 transition-colors hover:border-neutral-300"
              >
                <CameraIcon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{photos.length ? tr('More', '再加') : tr('Add', '添加')}</span>
              </button>
            )}
          </div>
          {filledIn && <p className="pt-2 text-[12px] leading-5 text-neutral-500">{filledIn}</p>}
        </div>

        <div className="mt-3 divide-y divide-neutral-100 border-y border-neutral-100">
          <Field label={tr('Day', '日期')}>
            <DateField
              value={date}
              onChange={(next) => {
                dateChosen.current = true
                if (next) setDate(next)
              }}
            />
          </Field>
          <Field label={tr('Favourite', '收藏')}>
            <Toggle checked={favorite} onChange={setFavorite} label={tr('Favourite', '收藏')} />
          </Field>
        </div>

        <div className="mt-4">
          <p className="pb-2 text-[13px] text-neutral-400">{tr('Kind of memory', '回忆类型')}</p>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setKind(option.id)}
                aria-pressed={kind === option.id}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  kind === option.id ? option.solid : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70'
                }`}
              >
                <KindGlyph kind={option.id} className="h-3.5 w-3.5" />
                {kindLabel(option.id)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="pb-2 text-[13px] text-neutral-400">{tr('Place', '地点')}</p>
          {place ? (
            <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3">
              {place.country ? <Flag code={place.country} /> : <PinIcon className="h-5 w-5 text-neutral-400" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">
                  {place.name || (point ? tr('A point on the map', '地图上的一个点') : countryName(place.country))}
                </p>
                <p className="truncate text-[12px] text-neutral-400">
                  {[place.country ? countryName(place.country) : null, point ? `${place.lat!.toFixed(4)}, ${place.lon!.toFixed(4)}` : tr('Not on the map', '不在地图上')]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuery(place.name)
                  setPlace(null)
                }}
                className="shrink-0 rounded-full px-2.5 py-1 text-[13px] font-medium text-brand-600 hover:bg-brand-50"
              >
                {tr('Change', '更改')}
              </button>
              <button
                type="button"
                onClick={() => setPlace(null)}
                aria-label={tr('Remove the place', '移除地点')}
                className="shrink-0 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100"
              >
                <Close className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setResults(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void search()
                    }
                  }}
                  placeholder={tr('Search a place, or type a name', '搜索地点，或直接输入名字')}
                  className="min-w-0 flex-1 rounded-xl bg-neutral-100 px-3 py-2 text-[15px] outline-hidden placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-brand-500/40"
                />
                <button
                  type="button"
                  onClick={() => void search()}
                  disabled={searching || query.trim().length < 2}
                  className="shrink-0 rounded-xl bg-neutral-900 px-4 text-[14px] font-medium text-white disabled:opacity-30"
                >
                  {searching ? <Spinner className="h-4 w-4" /> : tr('Search', '搜索')}
                </button>
              </div>
              {results && (
                <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-100">
                  {results.length === 0 && (
                    <p className="px-3 py-2.5 text-[13px] text-neutral-500">
                      {tr('Nothing found. The name will be kept as typed.', '没找到。会按输入的名字保存。')}
                    </p>
                  )}
                  {results.map((found) => (
                    <button
                      key={found.key}
                      type="button"
                      onClick={() => {
                        setPlace({ name: found.name, country: found.country || null, lat: found.lat, lon: found.lon })
                        setResults(null)
                        setQuery('')
                      }}
                      className="flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-neutral-50"
                    >
                      {found.country ? <Flag code={found.country} className="h-[14px] w-[20px]" /> : <PinIcon className="h-4 w-4 text-neutral-400" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{found.name}</span>
                        <span className="block truncate text-[12px] text-neutral-400">{found.address}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="pt-1.5 text-[12px] leading-5 text-neutral-400">
                {tr(
                  'Search to put it on the map. A name you only type is kept as a name.',
                  '搜索后会出现在地图上。只输入名字的话，就只保存名字。',
                )}
              </p>
            </>
          )}
        </div>

        <div className="mt-4 divide-y divide-neutral-100 border-y border-neutral-100">
          <div className="py-3">
            <NotesField
              value={story}
              onChange={setStory}
              placeholder={tr('What happened — who was there, what you ate, what made you laugh', '发生了什么——谁在场、吃了什么、什么让你笑了')}
            />
          </div>
          <div className="py-3">
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder={tr('People and tags, with commas: Mum, Aiman, birthday', '人物和标签，用逗号分开：妈妈、小明、生日')}
              className="w-full bg-transparent text-[15px] outline-hidden placeholder:text-neutral-300"
            />
          </div>
        </div>

        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            // Copied out before the reset: clearing the input empties its list.
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (files.length) void addPhotos(files)
          }}
        />
      </form>
    </Sheet>
  )
}
