import { useState } from 'react'
import { tr } from '../lib/i18n'
import { EMOJI_CHOICES } from '../lib/tags'

/**
 * Naming a tag: pick an emoji, type a label. Used both inline in the add
 * form and in More > Tags, so the two never drift apart.
 */
export default function TagEditor({
  initialLabel = '',
  initialEmoji = '📌',
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initialLabel?: string
  initialEmoji?: string
  submitLabel: string
  /** Throws with a readable message if the name is taken or empty. */
  onSubmit: (label: string, emoji: string) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [label, setLabel] = useState(initialLabel)
  const [emoji, setEmoji] = useState(initialEmoji)
  const [error, setError] = useState<string | null>(null)

  function submit() {
    try {
      onSubmit(label, emoji)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Could not save that tag.', '这个标签保存不了。'))
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-3">
      <div className="flex items-center gap-2">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          aria-label={tr('Emoji', '表情')}
          className="w-11 shrink-0 rounded-xl border border-neutral-200 py-2 text-center text-[17px] outline-hidden"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
          placeholder={tr('Tag name', '标签名称')}
          maxLength={20}
          className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-[15px] outline-hidden placeholder:text-neutral-300"
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {EMOJI_CHOICES.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => setEmoji(choice)}
            className={`h-8 w-8 rounded-lg text-[16px] ${
              emoji === choice ? 'bg-neutral-900/10' : 'active:bg-neutral-100'
            }`}
          >
            {choice}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-neutral-200 py-2 text-[14px] font-medium"
        >
          {tr('Cancel', '取消')}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full border border-neutral-200 px-4 py-2 text-[14px] font-medium text-red-600"
          >
            {tr('Delete', '删除')}
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          className="flex-1 rounded-full bg-brand-500 py-2 text-[14px] font-medium text-white"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
