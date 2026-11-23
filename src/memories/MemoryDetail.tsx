import { useState } from 'react'
import { useFileUrl } from '../components/Attachments'
import Flag from '../components/Flag'
import FullView from '../components/FullView'
import { PencilIcon, PinIcon, StarIcon } from '../components/Icons'
import Sheet from '../components/Sheet'
import { longDate } from '../lib/date'
import { tr } from '../lib/i18n'
import { countryName } from '../lib/places'
import { setMemoryFavorite } from '../lib/store'
import { googleMapsUrl } from '../seasons/where'
import type { Attachment, Memory } from '../types'
import { KindGlyph, kindLabel, kindOf } from './kinds'
import { Postmark } from './Stamp'

function Photo({ file, onOpen }: { file: Attachment; onOpen: (url: string) => void }) {
  const url = useFileUrl(file.type.startsWith('image/') ? file.id : null)
  if (!url) return <div className="h-64 w-48 shrink-0 snap-center rounded-2xl bg-neutral-100" />
  return (
    <button type="button" onClick={() => onOpen(url)} className="shrink-0 snap-center" aria-label={tr('See it full size', '查看大图')}>
      <img src={url} alt={file.name} className="h-64 w-auto max-w-[85vw] rounded-2xl object-cover sm:h-72" />
    </button>
  )
}

/** One memory, read: the photos to swipe through, the day, the place, the story. */
export default function MemoryDetail({
  memory,
  onClose,
  onEdit,
  onToast,
}: {
  memory: Memory
  onClose: () => void
  onEdit: () => void
  onToast: (message: string) => void
}) {
  const [full, setFull] = useState<{ url: string; name: string } | null>(null)
  const kind = kindOf(memory.kind)
  const place = memory.place
  const point = place && place.lat !== null && place.lon !== null

  return (
    <>
      <Sheet
        onClose={onClose}
        title={memory.title}
        large
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !memory.favorite
                void setMemoryFavorite(memory.id, next).then(() =>
                  onToast(next ? tr('Added to favourites', '已收藏') : tr('Taken out of favourites', '已取消收藏')),
                )
              }}
              aria-pressed={memory.favorite}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full border py-3 text-[15px] font-medium ${
                memory.favorite ? 'border-amber-200 bg-amber-50 text-amber-600' : 'border-neutral-200 text-neutral-700'
              }`}
            >
              <StarIcon className={`h-4 w-4 ${memory.favorite ? 'fill-current' : ''}`} />
              {memory.favorite ? tr('Favourite', '已收藏') : tr('Favourite', '收藏')}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white"
            >
              <PencilIcon className="h-4 w-4" />
              {tr('Edit', '编辑')}
            </button>
          </div>
        }
      >
        {memory.photos.length > 0 ? (
          <div className="-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
            {memory.photos.map((file) => (
              <Photo key={file.id} file={file} onOpen={(url) => setFull({ url, name: file.name })} />
            ))}
          </div>
        ) : (
          <div className={`flex h-36 items-center justify-center rounded-2xl ${kind.soft}`}>
            <KindGlyph kind={memory.kind} className="h-14 w-14 opacity-60" />
          </div>
        )}

        <div className="mt-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${kind.solid}`}>
              <KindGlyph kind={memory.kind} className="h-3.5 w-3.5" />
              {kindLabel(memory.kind)}
            </span>
            <p className="mt-2 text-[15px] text-neutral-600">{longDate(memory.date)}</p>
          </div>
          <Postmark memory={memory} big />
        </div>

        {place && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-neutral-50 p-3">
            {place.country ? <Flag code={place.country} /> : <PinIcon className="h-5 w-5 text-neutral-400" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{place.name || countryName(place.country)}</p>
              {place.country && place.name && <p className="truncate text-[12px] text-neutral-400">{countryName(place.country)}</p>}
            </div>
            {point && (
              <a
                href={googleMapsUrl(place.lat!, place.lon!)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-brand-600 hover:bg-brand-50"
              >
                {tr('Open in Maps', '在地图中打开')}
              </a>
            )}
          </div>
        )}

        {memory.story && <p className="mt-4 whitespace-pre-wrap text-[16px] leading-7 text-neutral-800">{memory.story}</p>}

        {memory.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {memory.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[13px] text-neutral-600">
                {tag}
              </span>
            ))}
          </div>
        )}
      </Sheet>
      {full && <FullView name={full.name} image={full.url} onClose={() => setFull(null)} />}
    </>
  )
}
