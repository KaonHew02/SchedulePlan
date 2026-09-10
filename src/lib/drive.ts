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
import { restore, snapshot, type Snapshot } from './store'

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'
const FILES = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

interface TokenClient {
  callback: (response: TokenResponse) => void
  requestAccessToken: (overrides?: { prompt?: string }) => void
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

async function getToken(): Promise<string> {
  if (token && Date.now() < tokenExpiresAt) return token
  await loadScript()

  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error("Couldn't load Google sign-in. Try again in a moment.")

  return new Promise<string>((resolve, reject) => {
    tokenClient ??= oauth2.initTokenClient({
      client_id: SP_DRIVE.clientId,
      scope: SCOPE,
      callback: () => {}, // replaced per request below
    })

    tokenClient.callback = (response) => {
      if (response.error || !response.access_token) {
        reject(new Error('Google sign-in was cancelled or refused.'))
        return
      }
      token = response.access_token
      // Expire a minute early so a request never starts on a dying token.
      tokenExpiresAt = Date.now() + ((response.expires_in ?? 3600) - 60) * 1000
      resolve(token)
    }

    try {
      tokenClient.requestAccessToken()
    } catch {
      reject(new Error("Couldn't open the Google sign-in window. Allow popups and retry."))
    }
  })
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

/** Write the whole schedule to Drive, replacing whatever was there. */
export async function saveToDrive(): Promise<number> {
  const data = snapshot()
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
  return data.schedule.length
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
export function applyDrive(data: Snapshot): number {
  return restore(data)
}
