import { useState } from 'react'
import { ChevronLeft } from '../components/Icons'
import TagEditor from '../components/TagEditor'
import {
  createTag,
  deleteTag,
  updateTag,
  useCategories,
  useTags,
  type TagKind,
} from '../lib/store'
import { tr } from '../lib/i18n'
import { tagName } from '../lib/tags'

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
  const [error, setError] = useState<string | null>(null)

  const noun = kind === 'tags' ? tr('tag', '标签') : tr('category', '分类')

  function guard(work: () => void) {
    try {
      setError(null)
      work()
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('That did not work.', '没有成功。'))
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-1 px-3 pb-3 pt-4 lg:px-6">
          <button
            onClick={onBack}
            aria-label={tr('Back to More', '返回「更多」')}
            className="p-1.5 text-neutral-400"
          >
            <ChevronLeft />
          </button>
          <h1 className="text-[19px] font-semibold tracking-tight">
            {kind === 'tags'
              ? tr('Schedule tags', '日程标签')
              : tr('Expense categories', '开销分类')}
          </h1>
        </div>
      </header>

      <main className="px-5 pb-28 lg:max-w-2xl lg:px-8 lg:pb-10">
        <p className="pb-4 pt-1 text-[13px] leading-5 text-neutral-500">
          {tr(
            'These are yours. Rename them, change the emoji, delete the ones you never use, add the ones you do.',
            '这些都由你决定：可以改名、换表情，删掉用不上的，加上用得着的。',
          )}
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
                  submitLabel={tr('Save', '保存')}
                  onCancel={() => setEditing(null)}
                  onSubmit={(label, emoji) =>
                    guard(() => {
                      updateTag(tag.id, label, emoji, kind)
                      setEditing(null)
                      onToast(tr('Updated', '已更新'))
                    })
                  }
                  onDelete={() => {
                    // Straight through. Nothing is lost either way — deleting a
                    // label untags records, it never deletes them — so the
                    // toast reports how many were touched instead of a dialog
                    // asking first.
                    setEditing(null)
                    const cleared = deleteTag(tag.id, kind)
                    onToast(
                      cleared
                        ? tr(`Deleted, ${cleared} untagged`, `已删除，已从 ${cleared} 项中移除`)
                        : tr('Deleted', '已删除'),
                    )
                  }}
                />
              </div>
            ) : (
              <button
                key={tag.id}
                onClick={() => setEditing(tag.id)}
                className="flex w-full items-center gap-3 py-3.5 text-left active:bg-neutral-50"
              >
                <span className="w-6 text-center text-[16px]">{tag.emoji}</span>
                <span className="flex-1 text-[15px]">{tagName(tag)}</span>
                <span className="text-[13px] text-neutral-300">{tr('Edit', '编辑')}</span>
              </button>
            ),
          )}

          {adding ? (
            <div className="py-3">
              <TagEditor
                submitLabel={tr('Add', '添加')}
                onCancel={() => setAdding(false)}
                onSubmit={(label, emoji) =>
                  guard(() => {
                    createTag(label, emoji, kind)
                    setAdding(false)
                    onToast(tr('Added', '已添加'))
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
              {tr(`+ New ${noun}`, `+ 新建${noun}`)}
            </button>
          )}
        </div>

      </main>
    </>
  )
}
