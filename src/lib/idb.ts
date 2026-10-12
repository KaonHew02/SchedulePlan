/**
 * IndexedDB, wrapped thin.
 *
 * SchedulePlan used to keep everything in one localStorage key. That stopped
 * being tenable the moment items could carry a photo: localStorage holds about
 * 5MB, stores strings only, and a base64'd receipt is a third bigger than the
 * file it came from. Two scans would fill it.
 *
 * So there are two stores. `records` holds one document — the whole notebook,
 * the same shape localStorage held — and `files` holds attachment blobs, one
 * per key, so a photo is never parsed or stringified just because a row was
 * rendered.
 */

import { tr } from './i18n'

const DB_NAME = 'scheduleplan'
const DB_VERSION = 1

export const RECORDS = 'records'
export const FILES = 'files'

/** The single key in `records`. There is only ever one notebook. */
export const DB_KEY = 'db'

let opening: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (opening) return opening

  opening = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(
        new Error(
          tr(
            'This browser has no IndexedDB, so there is nowhere to keep your data.',
            '这个浏览器没有 IndexedDB，所以没地方保存你的数据。',
          ),
        ),
      )
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(RECORDS)) db.createObjectStore(RECORDS)
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        new Error(
          tr(
            'This browser blocked its own database. Private mode can do that.',
            '这个浏览器拦住了自己的数据库。无痕模式可能会这样。',
          ),
        ),
      )
    // Another tab is holding an older version open. Rare, and it resolves
    // itself the moment that tab is closed — say so rather than hanging.
    request.onblocked = () =>
      reject(
        new Error(
          tr(
            'Another SchedulePlan tab is open with an older version. Close it and reload.',
            '另一个 SchedulePlan 标签页开着旧版本。请关掉它再重新加载。',
          ),
        ),
      )
  })

  // A failed open must not be cached, or every later call inherits the failure.
  opening.catch(() => {
    opening = null
  })
  return opening
}

function run<T>(store: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode)
        const request = work(transaction.objectStore(store))
        request.onsuccess = () => resolve(request.result)
        const refused = () => new Error(tr('The database refused that.', '数据库拒绝了这个操作。'))
        request.onerror = () => reject(request.error ?? refused())
        transaction.onabort = () =>
          reject(
            transaction.error?.name === 'QuotaExceededError'
              ? new Error(
                  tr(
                    'There is no room left in this browser. Remove some attachments.',
                    '这个浏览器没有空间了。请删掉一些附件。',
                  ),
                )
              : (transaction.error ?? refused()),
          )
      }),
  )
}

export const idbGet = <T>(store: string, key: string): Promise<T | undefined> =>
  run<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>)

export const idbPut = (store: string, key: string, value: unknown): Promise<unknown> =>
  run(store, 'readwrite', (s) => s.put(value, key))

export const idbDelete = (store: string, key: string): Promise<unknown> =>
  run(store, 'readwrite', (s) => s.delete(key))

export const idbKeys = (store: string): Promise<string[]> =>
  run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()).then((keys) => keys.map(String))

/**
 * Ask the browser not to evict this origin when it is short of room.
 *
 * Chrome grants it silently once the site looks used; Firefox prompts; Safari
 * ignores it. It is a request, not a guarantee — which is exactly why Export
 * and the Drive copy exist.
 */
export async function persist(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

export interface StorageUse {
  used: number
  quota: number
  persisted: boolean
}

/** What the "Your data" sheet shows. Figures are the browser's estimate. */
export async function storageUse(): Promise<StorageUse> {
  let used = 0
  let quota = 0
  try {
    const estimate = await navigator.storage?.estimate?.()
    used = estimate?.usage ?? 0
    quota = estimate?.quota ?? 0
  } catch {
    /* Older browsers have no estimate; the sheet copes with zeroes. */
  }
  let persisted = false
  try {
    persisted = (await navigator.storage?.persisted?.()) ?? false
  } catch {
    /* Same. */
  }
  return { used, quota, persisted }
}
