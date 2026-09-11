import { useEffect, useState } from 'react'
import { CloudIcon, DatabaseIcon, GoogleG, Spinner } from './Icons'
import Sheet from './Sheet'
import { storageUse, type StorageUse } from '../lib/idb'
import { prettySize, sweepFiles } from '../lib/files'
import { driveIsConfigured } from '../lib/drive-config'
import { itemCount, snapshot, useSettings } from '../lib/store'

/** 'just now', '2 days ago' — how long since, in the roundest useful unit. */
function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 90) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`
  const months = Math.round(days / 30)
  return `${months} ${months === 1 ? 'month' : 'months'} ago`
}

/** How full it is, in words, because a percentage under 1% tells you nothing. */
function fullness(used: number, quota: number): string {
  if (!quota) return 'the browser will not say how much room there is'
  const share = used / quota
  if (share < 0.01) return 'barely a dent'
  if (share < 0.1) return 'plenty of room left'
  if (share < 0.5) return 'comfortable'
  if (share < 0.85) return 'over half full'
  return 'nearly full — time to clear some attachments'
}

/**
 * Where the data is, and what the second copy is.
 *
 * This screen exists because "it's in your browser" is not something anyone
 * should have to take on faith. It says which store, whether the browser has
 * agreed to keep it, how much room it is taking, and when Drive last saw a
 * copy — and it is the one place that spells out that nothing leaves this
 * device unless a button is pressed.
 */
export default function DataSheet({
  onClose,
  onToast,
}: {
  onClose: () => void
  onToast: (message: string) => void
}) {
  const settings = useSettings()
  const [use, setUse] = useState<StorageUse | null>(null)
  const [sweeping, setSweeping] = useState(false)

  useEffect(() => {
    void storageUse().then(setUse)
  }, [])

  const data = snapshot()
  const attachments = [
    ...data.schedule.flatMap((item) => item.attachments),
    ...data.expenses.flatMap((expense) => expense.attachments),
  ]
  const attachmentBytes = attachments.reduce((total, file) => total + file.size, 0)
  const share = use?.quota ? Math.min(1, use.used / use.quota) : 0

  async function sweep() {
    setSweeping(true)
    try {
      const removed = await sweepFiles(attachments.map((file) => file.id))
      setUse(await storageUse())
      onToast(removed === 0 ? 'Nothing left over to clear' : `Cleared ${removed} stray files`)
    } catch {
      onToast("Couldn't tidy up just now")
    } finally {
      setSweeping(false)
    }
  }

  return (
    <Sheet onClose={onClose} title="Your data">
      <section>
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <DatabaseIcon className="h-[18px] w-[18px] text-neutral-400" />
          Where it lives
        </h3>
        <p className="mt-1.5 text-[14px] leading-6 text-neutral-600">
          In this browser, in IndexedDB.{' '}
          {use?.persisted
            ? 'Marked to be kept — the browser will not clear it to free space.'
            : 'The browser has not promised to keep it, so clearing site data would take it.'}
        </p>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${Math.max(0.6, share * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-[13px] text-neutral-500">
          {use ? (
            <>
              {prettySize(use.used)} of {use.quota ? prettySize(use.quota) : 'an unknown amount'} —{' '}
              {fullness(use.used, use.quota)}
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-neutral-400">
              <Spinner className="h-3 w-3" /> Measuring
            </span>
          )}
        </p>
        <p className="mt-1 text-[13px] text-neutral-400">
          {itemCount()} records and {attachments.length}{' '}
          {attachments.length === 1 ? 'attachment' : 'attachments'}
          {attachments.length > 0 && ` (${prettySize(attachmentBytes)})`}
        </p>
      </section>

      <section className="mt-6">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          {driveIsConfigured() ? (
            <GoogleG className="h-[18px] w-[18px]" />
          ) : (
            <CloudIcon className="h-[18px] w-[18px] text-neutral-400" />
          )}
          The second copy
        </h3>
        <p className="mt-1.5 text-[14px] leading-6 text-neutral-600">
          {settings.lastDriveSync ? (
            <>
              In Drive, {ago(settings.lastDriveSync)} —{' '}
              {new Date(settings.lastDriveSync).toLocaleString()}.
            </>
          ) : driveIsConfigured() ? (
            'Nothing has gone to Drive from this browser yet.'
          ) : (
            'Drive is not set up, so Export is the only second copy there is.'
          )}
        </p>
        <p className="mt-2 text-[14px] leading-6 text-neutral-600">
          Drive holds a <span className="font-medium">copy</span>, and so does an exported file —
          the same file either way. Nothing leaves this browser unless you press one of the
          buttons in the bar, and SchedulePlan works with no account at all.
        </p>
      </section>

      <section className="mt-6 border-t border-neutral-100 pt-4">
        <button
          onClick={sweep}
          disabled={sweeping}
          className="flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-[14px] font-medium disabled:opacity-40"
        >
          {sweeping && <Spinner className="h-4 w-4" />}
          Tidy up leftovers
        </button>
        <p className="mt-1.5 text-[12px] leading-5 text-neutral-400">
          Drops attachment files that no record points at any more. Nothing you can see is
          touched.
        </p>
      </section>

      <div className="mt-6 flex justify-end pb-2">
        <button
          onClick={onClose}
          className="rounded-full border border-neutral-200 px-6 py-2.5 text-[14px] font-medium"
        >
          Close
        </button>
      </div>
    </Sheet>
  )
}
