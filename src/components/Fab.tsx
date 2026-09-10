import { Plus } from './Icons'

/** The one add button, sitting just above the bottom nav. */
export default function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-[72px] z-30 pointer-events-none mb-safe">
      <div className="mx-auto max-w-md px-5 flex justify-end">
        <button
          onClick={onClick}
          aria-label={label}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg active:scale-95 transition-transform"
        >
          <Plus />
        </button>
      </div>
    </div>
  )
}
