import { useState } from 'react'
import { ChevronLeft } from '../components/Icons'
import TagEditor from '../components/TagEditor'
import {
  createTag,
  deleteTag,
  tagUsage,
  updateTag,
  useCategories,
  useTags,
  type TagKind,
} from '../lib/store'

/**
 * Editing the chips — schedule tags on one setting, expense categories on the
 * other. Same shape, same rules, so one screen does both.
 *
 * Deleting never takes records with it. A label is a way of looking at things,
 * not the things themselves, and losing an appointment because a tag was
 * tidied away would be a nasty surprise.
 */
export default function LabelsScreen({
  kind,
  onBack,
  onToast,
}: {
  kind: TagKind
  onBack: () => void
  onToast: (message: string) => void
}) {
  const tags = useTags()
  const categories = useCategories()
  const rows = kind === 'tags' ? tags : categories

  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<{ id: string; label: string; uses: number } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const noun = kind === 'tags' ? 'tag' : 'category'
  const used = kind === 'tags' ? 'schedule items' : 'expenses'

  function guard(work: () => void) {
    try {
      setError(null)
      work()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-1 px-3 pb-3 pt-4">
          <button onClick={onBack} aria-label="Back to More" className="p-1.5 text-neutral-400">
            <ChevronLeft />
          </button>
          <h1 className="text-[19px] font-semibold tracking-tight">
            {kind === 'tags' ? 'Schedule tags' : 'Expense categories'}
          </h1>
        </div>
      </header>

      <main className="px-5 pb-28">
        <p className="pb-4 pt-1 text-[13px] leading-5 text-neutral-500">
          These are yours. Rename them, change the emoji, delete the ones you never use, add the
          ones you do.
        </p>

        {error && (
          <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>
        )}

        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          {rows.map((tag) =>
            editing === tag.id ? (
              <div key={tag.id} className="py-3">
                <TagEditor
                  initialLabel={tag.label}
                  initialEmoji={tag.emoji}
                  submitLabel="Save"
                  onCancel={() => setEditing(null)}
                  onSubmit={(label, emoji) =>
                    guard(() => {
                      updateTag(tag.id, label, emoji, kind)
                      setEditing(null)
                      onToast('Updated')
                    })
                  }
                  onDelete={() => {
                    setEditing(null)
                    setRemoving({ id: tag.id, label: tag.label, uses: tagUsage(tag.id, kind) })
                  }}
                />
              </div>
            ) : (
              <button
                key={tag.id}
                onClick={() => {
                  setRemoving(null)
                  setEditing(tag.id)
                }}
                className="flex w-full items-center gap-3 py-3.5 text-left active:bg-neutral-50"
              >
                <span className="w-6 text-center text-[16px]">{tag.emoji}</span>
                <span className="flex-1 text-[15px]">{tag.label}</span>
                <span className="text-[13px] text-neutral-300">Edit</span>
              </button>
            ),
          )}

          {adding ? (
            <div className="py-3">
              <TagEditor
                submitLabel="Add"
                onCancel={() => setAdding(false)}
                onSubmit={(label, emoji) =>
                  guard(() => {
                    createTag(label, emoji, kind)
                    setAdding(false)
                    onToast('Added')
                  })
                }
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setEditing(null)
                setAdding(true)
              }}
              className="w-full py-3.5 text-left text-[15px] text-neutral-400 active:bg-neutral-50"
            >
              + New {noun}
            </button>
          )}
        </div>

        {removing && (
          <div className="mt-4 rounded-xl border border-neutral-200 p-4">
            <p className="text-[14px] leading-6">Delete the {removing.label} {noun}?</p>
            <p className="mt-1 text-[13px] leading-5 text-neutral-400">
              {removing.uses === 0
                ? 'Nothing is using it.'
                : `${removing.uses} ${
                    removing.uses === 1 ? used.replace(/s$/, '') : used
                  } will lose the ${noun}. Nothing is deleted.`}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRemoving(null)}
                className="flex-1 rounded-full border border-neutral-200 py-2.5 text-[14px] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const cleared = deleteTag(removing.id, kind)
                  setRemoving(null)
                  onToast(cleared ? `Deleted, ${cleared} untagged` : 'Deleted')
                }}
                className="flex-1 rounded-full bg-red-600 py-2.5 text-[14px] font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
