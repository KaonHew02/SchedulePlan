import { tr } from '../lib/i18n'
import type { MemoryKind } from '../types'

/**
 * The seven kinds of memory, and the colour each one is stamped in.
 *
 * Not only trips — that is the point of the module — so travel is one kind
 * among seven. Every class string is written out whole, because Tailwind only
 * builds the classes it can find in the source; `ink` is a hex because the
 * postmark is SVG.
 */
export interface KindInfo {
  id: MemoryKind
  /** The postmark's colour. */
  ink: string
  /** The label on the stamp, and the chip once it is picked. */
  solid: string
  /** A memory with no photo: the picture's place, in the kind's colour. */
  soft: string
  /** The dot on the map (MapCanvas takes Tailwind classes for it). */
  pin: string
}

export const KINDS: KindInfo[] = [
  { id: 'travel', ink: '#0284c7', solid: 'bg-sky-600 text-white', soft: 'bg-sky-50 text-sky-600', pin: 'bg-sky-600' },
  { id: 'food', ink: '#d97706', solid: 'bg-amber-600 text-white', soft: 'bg-amber-50 text-amber-600', pin: 'bg-amber-600' },
  { id: 'people', ink: '#e11d48', solid: 'bg-rose-600 text-white', soft: 'bg-rose-50 text-rose-600', pin: 'bg-rose-600' },
  { id: 'milestone', ink: '#6c5ce7', solid: 'bg-brand-500 text-white', soft: 'bg-brand-50 text-brand-600', pin: 'bg-brand-500' },
  { id: 'outdoors', ink: '#4d7c0f', solid: 'bg-lime-700 text-white', soft: 'bg-lime-50 text-lime-700', pin: 'bg-lime-700' },
  { id: 'event', ink: '#0f766e', solid: 'bg-teal-700 text-white', soft: 'bg-teal-50 text-teal-700', pin: 'bg-teal-700' },
  { id: 'everyday', ink: '#525252', solid: 'bg-neutral-600 text-white', soft: 'bg-neutral-100 text-neutral-500', pin: 'bg-neutral-600' },
]

export const kindOf = (id: MemoryKind): KindInfo => KINDS.find((kind) => kind.id === id) ?? KINDS[KINDS.length - 1]

export function kindLabel(id: MemoryKind): string {
  switch (id) {
    case 'travel':
      return tr('Travel', '旅行')
    case 'food':
      return tr('Food', '美食')
    case 'people':
      return tr('People', '亲友')
    case 'milestone':
      return tr('Milestone', '里程碑')
    case 'outdoors':
      return tr('Outdoors', '户外')
    case 'event':
      return tr('Events', '活动')
    default:
      return tr('Everyday', '日常')
  }
}

const GLYPH: Record<MemoryKind, string> = {
  travel: 'M3 11.5 21 3l-6.5 18-3-7.5L3 11.5ZM11.5 13.5 21 3',
  food: 'M3 11h18a9 9 0 0 1-18 0ZM9 20.5h6M8.5 7.5c0-1.4 1-1.8 1-3.2M12.5 7.5c0-1.4 1-1.8 1-3.2M16.5 7.5c0-1.4 1-1.8 1-3.2',
  people:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.6-3.6 3.2-6 6.5-6s5.9 2.4 6.5 6M15.5 4.3a3.5 3.5 0 0 1 0 6.4M17.5 14.4c2 .8 3.4 2.8 4 5.6',
  milestone: 'M5 21V4M5 4h12l-2.5 4.5L17 13H5',
  outdoors: 'M2 20 9 7l4.5 7 2.5-3.5L22 20ZM7 10.7l2 1.8 1.6-1.6',
  event: 'M4 6h16v3.5a2.5 2.5 0 0 0 0 5V18H4v-3.5a2.5 2.5 0 0 0 0-5ZM14.5 6v2M14.5 11v2M14.5 16v2',
  everyday:
    'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
}

/** The kind's own little picture: on the chips, and on a stamp that has no photo. */
export function KindGlyph({ kind, className = 'h-4 w-4' }: { kind: MemoryKind; className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={GLYPH[kind]} />
    </svg>
  )
}
