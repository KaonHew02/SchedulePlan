import { useState } from 'react'
import { applyUpdate, useUpdateReady } from '../lib/offline'

/**
 * A newer SchedulePlan has been downloaded and is waiting.
 *
 * It asks rather than reloading by itself: a reload halfway through typing a
 * booking reference would lose it. Put off with Later, the new version still
 * arrives the next time every SchedulePlan tab has been closed.
 *
 * On a phone it sits above the add button, which takes the bottom right
 * corner from 72px to 128px up: level with it, the bar ran under the button on
 * a 375px screen. Under the toasts rather than over them — a toast is gone in
 * two seconds, and this can wait that long.
 */
export default function UpdateBar() {
  const ready = useUpdateReady()
  const [later, setLater] = useState(false)
  if (!ready || later) return null

  return (
    <div className="fixed inset-x-0 bottom-[140px] z-30 flex justify-center px-4 mb-safe lg:bottom-8">
      <div className="animate-fade-in flex items-center gap-1 rounded-full bg-neutral-900 py-1.5 pl-4 pr-1.5 text-[13px] text-white shadow-lg">
        <span className="mr-1">A new version is ready</span>
        <button onClick={() => setLater(true)} className="rounded-full px-3 py-1 text-neutral-400">
          Later
        </button>
        <button
          onClick={applyUpdate}
          className="rounded-full bg-white px-3 py-1 font-medium text-neutral-900"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
