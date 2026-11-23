import { useId } from 'react'
import { useFileUrl } from '../components/Attachments'
import { ImageIcon, StarIcon } from '../components/Icons'
import { shortDate } from '../lib/date'
import { isZh, tr } from '../lib/i18n'
import { countryName } from '../lib/places'
import type { Memory } from '../types'
import { KindGlyph, kindLabel, kindOf } from './kinds'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** How wide a line of postmark text is, in Latin letters: a Chinese character is two. */
const width = (text: string) => [...text].reduce((total, ch) => total + (/[⺀-￿]/.test(ch) ? 2 : 1), 0)

/**
 * The cancellation: two rings with the place round the top and the country
 * round the bottom, the day in the middle, and wavy lines across the stamp.
 * Tilted by the memory's id, so a page of them does not line up like a form.
 */
export function Postmark({ memory, big = false }: { memory: Memory; big?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ink = kindOf(memory.kind).ink
  const [year, month, day] = memory.date.split('-')
  const top = (memory.place?.name || kindLabel(memory.kind)).toUpperCase().slice(0, 28)
  const bottom = (memory.place?.country ? countryName(memory.place.country) : 'SchedulePlan').toUpperCase().slice(0, 28)
  const tilt = (memory.id * 47) % 25 - 12
  const middle = isZh() ? `${Number(month)}月${Number(day)}日` : `${Number(day)} ${MONTHS[Number(month) - 1] ?? ''}`
  // Squeezed to the arc when it is long, rather than running off round the back.
  const fit = (text: string, most: number, length: number) =>
    width(text) > most ? { textLength: length, lengthAdjust: 'spacingAndGlyphs' as const } : {}

  return (
    <svg className={big ? 'memory-postmark-big' : 'memory-postmark'} viewBox="0 0 132 84" aria-hidden="true">
      <g transform={`rotate(${tilt} 88 42)`} stroke={ink} fill="none">
        <g strokeWidth="2" strokeLinecap="round">
          {[27, 38, 49, 60].map((y) => (
            <path key={y} d={`M2 ${y}q4-5 8 0t8 0t8 0t8 0t8 0t8 0`} />
          ))}
        </g>
        <circle cx="88" cy="42" r="38" strokeWidth="2" />
        <circle cx="88" cy="42" r="25" strokeWidth="1.1" />
        <path id={`${id}t`} d="M59 42a29 29 0 0 1 58 0" stroke="none" />
        <path id={`${id}b`} d="M54.5 42a33.5 33.5 0 0 0 67 0" stroke="none" />
      </g>
      <g transform={`rotate(${tilt} 88 42)`} fill={ink}>
        <text fontSize="7.5" letterSpacing="1.1">
          <textPath href={`#${id}t`} startOffset="50%" {...fit(top, 14, 84)}>
            {top}
          </textPath>
        </text>
        <text fontSize="7.5" letterSpacing="1.1">
          <textPath href={`#${id}b`} startOffset="50%" {...fit(bottom, 16, 96)}>
            {bottom}
          </textPath>
        </text>
        <text x="88" y="41" fontSize={isZh() ? 9.5 : 10.5}>
          {middle}
        </text>
        <text x="88" y="53" fontSize="9.5">
          {year}
        </text>
      </g>
    </svg>
  )
}

/** One memory as a stamp: the cover photo (or its kind's picture), the postmark, the title. */
export function Stamp({ memory, onOpen }: { memory: Memory; onOpen: () => void }) {
  const kind = kindOf(memory.kind)
  const cover = memory.photos[0] ?? null
  const url = useFileUrl(cover && cover.type.startsWith('image/') ? cover.id : null)
  const where = memory.place?.name || (memory.place?.country ? countryName(memory.place.country) : '')

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${memory.title}, ${shortDate(memory.date)}`}
      className="memory-stamp relative flex min-w-0 flex-col gap-2 p-[11px] pb-3 text-left transition-transform duration-200 hover:-translate-y-0.5"
    >
      <span className={`relative block aspect-[4/5] overflow-hidden ${kind.soft}`}>
        {url ? (
          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center opacity-60">
            <KindGlyph kind={memory.kind} className="h-12 w-12" />
          </span>
        )}
        <span
          className={`absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${kind.solid}`}
        >
          {kindLabel(memory.kind)}
        </span>
        {memory.photos.length > 1 && (
          <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] tabular-nums text-white">
            <ImageIcon className="h-3 w-3" />
            {memory.photos.length}
          </span>
        )}
        {memory.favorite && (
          <span className="absolute left-1.5 top-1.5 text-amber-400 drop-shadow-sm" title={tr('Favourite', '收藏')}>
            <StarIcon className="h-[18px] w-[18px] fill-current" />
          </span>
        )}
      </span>
      <Postmark memory={memory} />
      <span className="min-w-0">
        <span className="line-clamp-2 text-[15px] font-semibold leading-tight text-neutral-900">{memory.title}</span>
        <span className="mt-0.5 block truncate text-[12px] text-neutral-400">
          {shortDate(memory.date)}
          {where && ` · ${where}`}
        </span>
      </span>
    </button>
  )
}

/** A memory as a row: the map's list, On this day. */
export function MemoryRow({ memory, note, onOpen }: { memory: Memory; note?: string; onOpen: () => void }) {
  const kind = kindOf(memory.kind)
  const cover = memory.photos[0] ?? null
  const url = useFileUrl(cover && cover.type.startsWith('image/') ? cover.id : null)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full min-w-0 items-center gap-3 rounded-2xl bg-white p-2 text-left shadow-xs transition-colors hover:bg-neutral-50"
    >
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl ${kind.soft}`}>
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <KindGlyph kind={memory.kind} className="h-6 w-6" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{memory.title}</span>
        <span className="block truncate text-[12px] text-neutral-400">
          {note ? `${note} · ` : ''}
          {shortDate(memory.date)} {memory.date.slice(0, 4)}
          {memory.place?.name ? ` · ${memory.place.name}` : ''}
        </span>
      </span>
    </button>
  )
}
