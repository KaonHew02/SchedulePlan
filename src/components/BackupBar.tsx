import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CloudDownIcon,
  CloudIcon,
  CloudUpIcon,
  DownloadIcon,
  RefreshIcon,
  Spinner,
  UploadIcon,
} from './Icons'
import { todayISO } from '../lib/date'
import { useDriveAutosave, type AutoState } from '../lib/autosave'
import { applyDrive, peekDrive, preloadDrive, saveToDrive } from '../lib/drive'
import { driveIsConfigured } from '../lib/drive-config'
import {
  countIn,
  fullSnapshot,
  itemCount,
  restore,
  updateSettings,
  useSaveState,
  useSettings,
  type Snapshot,
} from '../lib/store'

/**
 * One strip for everything to do with copies of your notebook.
 *
 * It replaced a list of four rows reading "Export a copy — downloads one JSON
 * file", which was accurate and completely forgettable. The bar puts the thing
 * that actually matters first — *when did this last get saved, and is there a
 * copy anywhere else* — and makes the four actions one tap rather than a row
 * to read and then choose.
 */

/** A pending replace, held until the user has seen what it would do. */
interface Pending {
  source: string
  data: Snapshot
}

function timeOf(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function autoNote(state: AutoState): string | null {
  switch (state.kind) {
    case 'waiting':
      return 'Drive copy queued'
    case 'saving':
      return 'Copying to Drive…'
    case 'needs-tap':
      return 'Press To Drive once to sign in again — auto cannot open the Google window by itself.'
    case 'error':
      return state.message
    default:
      return null
  }
}

function Action({
  icon,
  label,
  onClick,
  disabled,
  busy,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-medium text-neutral-200 transition-colors hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {busy ? <Spinner className="h-3.5 w-3.5" /> : icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

export default function BackupBar({
  onToast,
  onOpenData,
}: {
  onToast: (message: string) => void
  onOpenData: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const settings = useSettings()
  const save = useSaveState()
  const auto = useDriveAutosave()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const configured = driveIsConfigured()

  useEffect(preloadDrive, [])

  function run(label: string, work: () => Promise<void>) {
    setError(null)
    setBusy(label)
    work()
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong.'))
      .finally(() => setBusy(null))
  }

  async function exportFile() {
    const data = await fullSnapshot()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `scheduleplan-${todayISO()}.json`
    link.click()
    // Revoking straight away can beat the download starting in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
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
    const source = pending.source
    run('restore', async () => {
      const count = source === 'Drive' ? await applyDrive(pending.data) : await restore(pending.data)
      setPending(null)
      onToast(`Restored ${count} items`)
    })
  }

  const note = autoNote(auto)

  return (
    <>
      <div className="rounded-2xl bg-neutral-900 p-2">
        <div className="flex items-center gap-2 px-1.5 pb-1.5 pt-1">
          <button
            onClick={onOpenData}
            className="flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-0.5 text-[13px] text-neutral-400 transition-colors hover:text-neutral-200"
          >
            {save.saving ? (
              <>
                <Spinner className="h-3.5 w-3.5" />
                Saving
              </>
            ) : save.error ? (
              <span className="text-red-400">Not saved — tap to see why</span>
            ) : save.savedAt ? (
              <>
                Saved {timeOf(save.savedAt)}
                <CloudIcon className="h-3.5 w-3.5 text-neutral-500" />
              </>
            ) : (
              'Your data'
            )}
          </button>

          <button
            onClick={() => updateSettings({ autoDrive: !settings.autoDrive })}
            disabled={!configured}
            aria-pressed={settings.autoDrive}
            className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-35 ${
              settings.autoDrive
                ? 'bg-blue-600 text-white'
                : 'text-neutral-300 hover:bg-white/10'
            }`}
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            Auto
          </button>
        </div>

        {/*
          Two by two on a phone, four across from 380px up. Four in a row is
          361px of buttons, which on a 320px screen pushed the whole page into
          scrolling sideways — and a notebook that slides left when you touch
          it feels broken long before you work out why.
        */}
        <div className="grid grid-cols-2 gap-0.5 border-t border-white/10 pt-1.5 min-[380px]:grid-cols-4">
          <Action
            icon={<CloudUpIcon className="h-3.5 w-3.5" />}
            label="To Drive"
            disabled={!configured || busy !== null}
            busy={busy === 'save'}
            onClick={() =>
              run('save', async () => {
                const count = await saveToDrive()
                onToast(`Saved ${count} items to Drive`)
              })
            }
          />
          <Action
            icon={<CloudDownIcon className="h-3.5 w-3.5" />}
            label="From Drive"
            disabled={!configured || busy !== null}
            busy={busy === 'load'}
            onClick={() =>
              run('load', async () => {
                setPending({ source: 'Drive', data: await peekDrive() })
              })
            }
          />
          <Action
            icon={<DownloadIcon className="h-3.5 w-3.5" />}
            label="Export"
            busy={busy === 'export'}
            disabled={busy !== null}
            onClick={() => run('export', exportFile)}
          />
          <Action
            icon={<UploadIcon className="h-3.5 w-3.5" />}
            label="Import"
            disabled={busy !== null}
            onClick={() => fileInput.current?.click()}
          />
        </div>
      </div>

      {!configured && (
        <p className="px-1 pt-2 text-[12px] leading-5 text-neutral-400">
          Drive is not set up in this build, so Export and Import are the second copy. See
          docs/DRIVE.md.
        </p>
      )}

      {note && (
        <p
          className={`px-1 pt-2 text-[12px] leading-5 ${
            auto.kind === 'error' || auto.kind === 'needs-tap'
              ? 'text-amber-700'
              : 'text-neutral-400'
          }`}
        >
          {note}
        </p>
      )}

      {save.error && (
        <p className="mt-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-700">
          This browser would not save that change: {save.error}
        </p>
      )}

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
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-700">
          {error}
        </p>
      )}

      {pending && (
        <div className="mt-3 rounded-xl border border-neutral-200 p-4">
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
              disabled={busy === 'restore'}
              className="flex-1 rounded-full bg-neutral-900 py-2.5 text-[14px] font-medium text-white disabled:opacity-40"
            >
              {busy === 'restore' ? 'Restoring...' : 'Replace'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
