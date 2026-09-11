/**
 * Keeping the Drive copy current without being asked each time.
 *
 * There is a hard limit on how automatic this can be, and it is worth being
 * plain about rather than papering over. Getting a Google token opens a popup,
 * and browsers only allow that inside the click that asked for it. A timer
 * cannot do it. So autosave rides a token that a **To Drive** tap already
 * obtained, and once that hour is up it stops and says so — which is honest,
 * and better than a switch labelled Auto that quietly stopped working after
 * lunch.
 */

import { useEffect, useState } from 'react'
import { driveIsConfigured } from './drive-config'
import { hasLiveToken, saveToDrive } from './drive'
import { onSaved, readSettings } from './store'

/** Long enough that a burst of edits is one upload, short enough to matter. */
const QUIET_MS = 6000

export type AutoState =
  | { kind: 'off' }
  | { kind: 'idle' }
  | { kind: 'waiting' }
  | { kind: 'saving' }
  | { kind: 'needs-tap' }
  | { kind: 'error'; message: string }

export function useDriveAutosave(): AutoState {
  const [state, setState] = useState<AutoState>({ kind: 'off' })

  useEffect(() => {
    if (!driveIsConfigured()) return

    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const stop = onSaved(() => {
      if (!readSettings().autoDrive) {
        setState({ kind: 'off' })
        return
      }
      if (!hasLiveToken()) {
        setState({ kind: 'needs-tap' })
        return
      }

      // Each change pushes the upload back, so typing through a form is one
      // write at the end rather than one per keystroke.
      if (timer) clearTimeout(timer)
      setState({ kind: 'waiting' })
      timer = setTimeout(() => {
        if (cancelled) return
        setState({ kind: 'saving' })
        saveToDrive()
          .then(() => {
            if (!cancelled) setState({ kind: 'idle' })
          })
          .catch((err: unknown) => {
            if (cancelled) return
            setState(
              hasLiveToken()
                ? {
                    kind: 'error',
                    message: err instanceof Error ? err.message : 'Drive refused that.',
                  }
                : { kind: 'needs-tap' },
            )
          })
      }, QUIET_MS)
    })

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      stop()
    }
  }, [])

  return state
}
