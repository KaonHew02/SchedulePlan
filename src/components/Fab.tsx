import { useAddAction } from '../lib/add'
import { Plus } from './Icons'

/**
 * The one add button. On a laptop it sits in the bottom right corner; on a
 * phone it is not drawn here at all — it becomes the + in the middle of the
 * tab bar (lib/add.ts), so this only tells the tab bar what to do. Its
 * container has to track the frame's width classes exactly, or it drifts out
 * of line with the content it belongs to.
 */
export default function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  useAddAction(label, onClick)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-30 max-lg:hidden">
      <div className="mx-auto flex justify-end px-8">
        <button
          onClick={onClick}
          aria-label={label}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg active:scale-95 transition-transform"
        >
          <Plus />
        </button>
      </div>
    </div>
  )
}
