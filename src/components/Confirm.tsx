import { useEffect, type ReactNode } from 'react'

/**
 * A yes/no dialog, floating over the page.
 *
 * This used to be a bordered card rendered inline, and the Drive restore is
 * what showed why that was wrong: the question appeared *between* the backup
 * bar and the screen's own header, shoving the whole notebook down the page.
 * A question that stops everything should look like it stops everything —
 * dimmed page behind it, nothing else moved.
 *
 * Deliberately not `Sheet`. A sheet slides up from the bottom and is sized for
 * a form; a confirmation is two sentences and two buttons, and belongs in the
 * middle of the screen where the eye already is.
 */
export default function Confirm({
  title,
  detail,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'brand',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: ReactNode
  /** The consequence, in smaller type. Optional — some questions need none. */
  detail?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** 'danger' for anything that destroys records. */
  tone?: 'brand' | 'danger'
  /** Keeps the dialog up, with the action spinning, while the work runs. */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-neutral-900/25 animate-fade-in" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl animate-pop-in"
      >
        <p className="text-[15px] leading-6">{title}</p>
        {detail && <p className="mt-1 text-[13px] leading-5 text-neutral-400">{detail}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-neutral-200 py-2.5 text-[14px] font-medium"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className={`flex-1 rounded-full py-2.5 text-[14px] font-medium text-white disabled:opacity-40 ${
              tone === 'danger' ? 'bg-red-600' : 'bg-brand-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
