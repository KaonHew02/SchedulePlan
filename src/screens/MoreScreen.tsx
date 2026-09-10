import { useEffect, useRef, useState, type ReactNode } from 'react'
import Logo from '../components/Logo'
import { todayISO } from '../lib/date'
import { driveIsConfigured } from '../lib/drive-config'
import { applyDrive, peekDrive, preloadDrive, saveToDrive } from '../lib/drive'
import { itemCount, restore, snapshot, type Snapshot } from '../lib/store'

/** A pending replace, held until the user has seen what it would do. */
interface Pending {
  source: string
  data: Snapshot
}

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
    onToast(`Exported ${data.schedule.length} items`)
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
        <div className="mx-auto max-w-md px-5 pt-4 pb-3">
          <h1 className="text-[19px] font-semibold tracking-tight">More</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pb-28">
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
              Replace the {itemCount()} items on this device with{' '}
              {pending.data.schedule.length} from {pending.source}?
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

        <p className="pt-10 pb-8 text-center text-[13px] leading-5 text-neutral-400">
          Currency converter, bill split, documents and categories arrive in later phases.
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
