import { useEffect, useRef, useState, type ReactNode } from 'react'
import Logo from '../components/Logo'
import TagEditor from '../components/TagEditor'
import { todayISO } from '../lib/date'
import { driveIsConfigured } from '../lib/drive-config'
import { applyDrive, peekDrive, preloadDrive, saveToDrive } from '../lib/drive'
import {
  createTag,
  deleteTag,
  itemCount,
  restore,
  snapshot,
  tagUsage,
  updateTag,
  useTags,
  type Snapshot,
} from '../lib/store'

/** A pending replace, held until the user has seen what it would do. */
interface Pending {
  source: string
  data: Snapshot
}

const countIn = (data: Snapshot) =>
  (data.schedule?.length ?? 0) + (data.reminders?.length ?? 0)

function Row({
  label,
  hint,
  onClick,
  disabled,
}: {
  label: string
  hint?: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3.5 text-left disabled:opacity-40 active:bg-neutral-50"
    >
      <span className="text-[15px]">{label}</span>
      {hint && <span className="block text-[13px] text-neutral-400">{hint}</span>}
    </button>
  )
}

export default function MoreScreen({ onToast }: { onToast: (message: string) => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const configured = driveIsConfigured()

  const tags = useTags()
  const [editing, setEditing] = useState<string | null>(null)
  const [addingTag, setAddingTag] = useState(false)
  const [removing, setRemoving] = useState<{ id: string; label: string; uses: number } | null>(
    null,
  )

  useEffect(preloadDrive, [])

  function run(label: string, work: () => Promise<void>) {
    setError(null)
    setBusy(label)
    work()
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong.'))
      .finally(() => setBusy(null))
  }

  function exportFile() {
    const data = snapshot()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `scheduleplan-${todayISO()}.json`
    link.click()
    URL.revokeObjectURL(url)
    onToast(`Exported ${countIn(data)} items`)
  }

  async function readChosenFile(file: File) {
    let data: Snapshot
    try {
      data = JSON.parse(await file.text()) as Snapshot
    } catch {
      throw new Error("That file isn't readable JSON.")
    }
    if (!Array.isArray(data?.schedule)) {
      throw new Error("That file isn't a SchedulePlan backup.")
    }
    setPending({ source: file.name, data })
  }

  function confirmReplace() {
    if (!pending) return
    try {
      const count = pending.source === 'Drive' ? applyDrive(pending.data) : restore(pending.data)
      setPending(null)
      onToast(`Restored ${count} items`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore that backup.')
      setPending(null)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="px-5 pt-4 pb-3">
          <h1 className="text-[19px] font-semibold tracking-tight">More</h1>
        </div>
      </header>

      <main className="px-5 pb-28">
        <p className="pt-2 pb-4 text-[13px] leading-5 text-neutral-500">
          Your schedule is kept in this browser only. Clearing site data clears it, so keep a
          copy somewhere.
        </p>

        <h2 className="pb-1 text-[13px] font-medium text-neutral-400">Backup</h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          <Row label="Export a copy" hint="Downloads one JSON file" onClick={exportFile} />
          <Row
            label="Import a file"
            hint="Replaces everything on this device"
            onClick={() => fileInput.current?.click()}
          />
          <Row
            label={busy === 'save' ? 'Saving to Drive...' : 'Save to Drive'}
            hint={configured ? 'Overwrites the Drive copy' : 'Drive is not set up yet'}
            disabled={!configured || busy !== null}
            onClick={() =>
              run('save', async () => {
                const count = await saveToDrive()
                onToast(`Saved ${count} items to Drive`)
              })
            }
          />
          <Row
            label={busy === 'load' ? 'Reading Drive...' : 'Load from Drive'}
            hint={configured ? 'Replaces everything on this device' : 'See docs/DRIVE.md'}
            disabled={!configured || busy !== null}
            onClick={() =>
              run('load', async () => {
                setPending({ source: 'Drive', data: await peekDrive() })
              })
            }
          />
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = '' // so choosing the same file twice still fires
            if (file) run('import', () => readChosenFile(file))
          }}
        />

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-700">
            {error}
          </p>
        )}

        {pending && (
          <div className="mt-4 rounded-xl border border-neutral-200 p-4">
            <p className="text-[14px] leading-6">
              Replace the {itemCount()} items on this device with {countIn(pending.data)} from{' '}
              {pending.source}?
            </p>
            <p className="mt-1 text-[13px] text-neutral-400">
              This cannot be undone. Export first if you are unsure.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPending(null)}
                className="flex-1 rounded-full border border-neutral-200 py-2.5 text-[14px] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmReplace}
                className="flex-1 rounded-full bg-neutral-900 py-2.5 text-[14px] font-medium text-white"
              >
                Replace
              </button>
            </div>
          </div>
        )}

        <h2 className="pt-8 pb-1 text-[13px] font-medium text-neutral-400">Tags</h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          {tags.map((tag) =>
            editing === tag.id ? (
              <div key={tag.id} className="py-3">
                <TagEditor
                  initialLabel={tag.label}
                  initialEmoji={tag.emoji}
                  submitLabel="Save"
                  onCancel={() => setEditing(null)}
                  onSubmit={(label, emoji) => {
                    updateTag(tag.id, label, emoji)
                    setEditing(null)
                    onToast('Tag updated')
                  }}
                  onDelete={() => {
                    setEditing(null)
                    setRemoving({ id: tag.id, label: tag.label, uses: tagUsage(tag.id) })
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

          {addingTag ? (
            <div className="py-3">
              <TagEditor
                submitLabel="Add"
                onCancel={() => setAddingTag(false)}
                onSubmit={(label, emoji) => {
                  createTag(label, emoji)
                  setAddingTag(false)
                  onToast('Tag added')
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setEditing(null)
                setAddingTag(true)
              }}
              className="w-full py-3.5 text-left text-[15px] text-neutral-400 active:bg-neutral-50"
            >
              + New tag
            </button>
          )}
        </div>

        {removing && (
          <div className="mt-4 rounded-xl border border-neutral-200 p-4">
            <p className="text-[14px] leading-6">
              Delete the {removing.label} tag?
            </p>
            <p className="mt-1 text-[13px] leading-5 text-neutral-400">
              {removing.uses === 0
                ? 'Nothing is using it.'
                : `${removing.uses} schedule ${
                    removing.uses === 1 ? 'item' : 'items'
                  } will lose the tag. Nothing is deleted.`}
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
                  const cleared = deleteTag(removing.id)
                  setRemoving(null)
                  onToast(cleared ? `Tag deleted, ${cleared} untagged` : 'Tag deleted')
                }}
                className="flex-1 rounded-full bg-red-600 py-2.5 text-[14px] font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        <p className="pt-10 pb-8 text-center text-[13px] leading-5 text-neutral-400">
          Currency converter, bill split and documents arrive in later phases.
        </p>

        <div className="flex flex-col items-center gap-2">
          <Logo size={44} />
          <p className="text-[14px] font-medium tracking-tight">SchedulePlan</p>
          <p className="text-[13px] text-neutral-300">Version 0.1</p>
        </div>
      </main>
    </>
  )
}
