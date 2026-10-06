/**
 * The Drive copy: one JSON file, in one folder, written and read by this app.
 *
 * The scope is `drive.file`, which is the narrow one — it reaches only files
 * this app itself created. It cannot see the rest of your Drive, and no
 * consent screen review is needed for it.
 *
 * The token lives in memory for the hour Google gives it and is never written
 * to storage. Signing out is closing the tab.
 */

import { SP_DRIVE, driveIsConfigured } from './drive-config'
import { fullSnapshot, restore, updateSettings, type Snapshot } from './store'

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'
/** The id Google's script checks before adding its button stylesheet. See `loadScript`. */
const GIS_BUTTON_STYLES = 'googleidentityservice_button_styles'
const FILES = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void
}

/** Why Google's window gave no token back: blocked, closed, or something else. */
interface PopupError {
  type: 'popup_failed_to_open' | 'popup_closed' | 'unknown' | string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: TokenResponse) => void
            error_callback?: (error: PopupError) => void
          }) => TokenClient
        }
      }
    }
  }
}

let scriptLoading: Promise<void> | null = null
let tokenClient: TokenClient | null = null
let token: string | null = null
let tokenExpiresAt = 0
/** The sign-in Google's window is answering, while one is open. */
let answer: { resolve: (token: string) => void; reject: (error: Error) => void } | null = null

/**
 * Pull Google's script in early. The sign-in popup has to open inside the
 * click that asked for it, so waiting for a script download at that moment is
 * what gets it blocked.
 */
export function preloadDrive(): void {
  if (driveIsConfigured()) void loadScript()
}

function loadScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptLoading) return scriptLoading

  // Google's script carries the stylesheet for its "Sign in with Google"
  // button, and puts it in the page as an inline <style> the moment it loads.
  // The page's security policy refuses inline styles, so every visit logged
  // an error in the console — for a button this app never shows: Drive
  // sign-in happens in Google's own popup window. The script skips the
  // stylesheet when an element with this id is already in the page, so one
  // is put there first. Keeping the policy strict beats allowing the
  // stylesheet by its hash, which breaks whenever Google restyles the button.
  if (!document.getElementById(GIS_BUTTON_STYLES)) {
    const placeholder = document.createElement('template')
    placeholder.id = GIS_BUTTON_STYLES
    document.head.appendChild(placeholder)
  }

  scriptLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoading = null
      reject(new Error("Couldn't reach Google. Check your connection and try again."))
    }
    document.head.appendChild(script)
  })
  return scriptLoading
}

/** What to say when Google's window gave no token back. */
function popupProblem(error: PopupError): Error {
  if (error.type === 'popup_failed_to_open') {
    return new Error(
      'The Google sign-in window was blocked. Tap the button again; if it keeps happening, allow pop-ups for this site.',
    )
  }
  if (error.type === 'popup_closed') {
    return new Error('The Google window was closed before signing in finished. Tap the button to try again.')
  }
  return new Error('Google sign-in did not finish. Tap the button to try again.')
}

async function getToken(): Promise<string> {
  if (token && Date.now() < tokenExpiresAt) return token
  await loadScript()

  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error("Couldn't load Google sign-in. Try again in a moment.")

  tokenClient ??= oauth2.initTokenClient({
    client_id: SP_DRIVE.clientId,
    scope: SCOPE,
    callback: (response) => {
      const waiting = answer
      answer = null
      if (!waiting) return
      if (response.error || !response.access_token) {
        waiting.reject(new Error('Google sign-in was cancelled or refused.'))
        return
      }
      token = response.access_token
      // Expire a minute early so a request never starts on a dying token.
      tokenExpiresAt = Date.now() + ((response.expires_in ?? 3600) - 60) * 1000
      waiting.resolve(token)
    },
    // Google calls this, and not `callback`, when its window could not open
    // or was closed before signing in finished. Without it the sign-in never
    // ended: the button spun for good and all four buttons stayed greyed out
    // until the page was reloaded.
    error_callback: (error) => {
      const waiting = answer
      answer = null
      waiting?.reject(popupProblem(error))
    },
  })

  return new Promise<string>((resolve, reject) => {
    // A second tap while a window is still open: the first one is over.
    answer?.reject(popupProblem({ type: 'popup_closed' }))
    answer = { resolve, reject }
    try {
      tokenClient!.requestAccessToken()
    } catch {
      answer = null
      reject(new Error("Couldn't open the Google sign-in window. Allow pop-ups and retry."))
    }
  })
}

/**
 * Is there a usable token right now?
 *
 * Autosave leans on this. Getting a token opens Google's popup, and a browser
 * only allows that inside the click that asked for it — so a background save
 * can ride an existing token but can never go and fetch a new one. When this
 * is false the bar says to press To Drive once, rather than silently failing
 * every few minutes.
 */
export function hasLiveToken(): boolean {
  return Boolean(token) && Date.now() < tokenExpiresAt
}

async function call(url: string, init: RequestInit): Promise<Response> {
  const accessToken = await getToken()
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new Error("Couldn't reach Google Drive. Check your connection.")
  }

  if (response.status === 401 || response.status === 403) {
    token = null // force a fresh consent next time rather than looping on a stale one
    throw new Error('Google Drive refused that. Check the folder ID in drive-config.ts.')
  }
  if (response.status === 404) {
    throw new Error("That Drive folder doesn't exist, or this app can't see it.")
  }
  if (!response.ok) {
    throw new Error(`Google Drive returned an error (${response.status}).`)
  }
  return response
}

/** The app's file in the configured folder, if it has been written before. */
async function findFile(): Promise<string | null> {
  const query = encodeURIComponent(
    `'${SP_DRIVE.folderId}' in parents and name = '${SP_DRIVE.filename}' and trashed = false`,
  )
  const response = await call(`${FILES}?q=${query}&fields=files(id)&pageSize=1`, {})
  const body = (await response.json()) as { files?: { id: string }[] }
  return body.files?.[0]?.id ?? null
}

/**
 * Write the whole notebook to Drive, replacing whatever was there.
 *
 * Attachments go too, inlined as data URLs, which is what makes the Drive copy
 * a real second copy rather than a list of records pointing at photos that
 * only ever existed on one device.
 */
export async function saveToDrive(): Promise<number> {
  // Sign in before gathering the notebook, not after. Safari on an iPhone
  // lets a window open only within about a second of the tap that asked for
  // it, and gathering a notebook with photos in it takes longer than that:
  // Google's window was blocked without a word, so To Drive did nothing,
  // while From Drive, which signs in first, worked.
  await getToken()
  const data = await fullSnapshot()
  const body = JSON.stringify(data, null, 2)
  const existing = await findFile()

  if (existing) {
    await call(`${UPLOAD}/${existing}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  } else {
    const boundary = 'scheduleplan-' + Date.now()
    const metadata = { name: SP_DRIVE.filename, parents: [SP_DRIVE.folderId] }
    await call(`${UPLOAD}?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body:
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n` +
        `--${boundary}--`,
    })
  }

  updateSettings({ lastDriveSync: new Date().toISOString() })
  return data.schedule.length + data.reminders.length + data.expenses.length
}

/** Read the Drive copy without applying it, so the user can be told what is in it. */
export async function peekDrive(): Promise<Snapshot> {
  const existing = await findFile()
  if (!existing) {
    throw new Error('There is no SchedulePlan file in that Drive folder yet.')
  }
  const response = await call(`${FILES}/${existing}?alt=media`, {})
  return (await response.json()) as Snapshot
}

/** Replace everything on this device with the Drive copy. */
export function applyDrive(data: Snapshot): Promise<number> {
  return restore(data)
}
