/**
 * Attachments: the bytes, and what is done to them on the way in.
 *
 * Records live in one IndexedDB document (store.ts). Files do not — a photo
 * has no business being parsed out of JSON every time a row renders, so each
 * one is its own key in its own store, and the record keeps only the id, the
 * name and the size.
 *
 * Photos are also shrunk before they land. A modern phone camera writes 4MB
 * of pixels nobody will ever look at on a 390px screen; storing that whole
 * would fill the browser's allowance in a fortnight.
 */

import { FILES, idbDelete, idbGet, idbKeys, idbPut } from './idb'
import type { Attachment } from '../types'

/** Long edge, in pixels, that a stored photo is reduced to. */
const MAX_EDGE = 1800

/** JPEG quality for a re-encoded photo. Above this the gain is invisible. */
const QUALITY = 0.82

/** Anything bigger than this is refused outright, before it is read. */
const MAX_FILE = 25 * 1024 * 1024

export function newFileId(): string {
  return crypto.randomUUID?.() ?? `f${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const isImage = (type: string): boolean => type.startsWith('image/')

/** '640 KB', '1.2 MB', '3.1 GB' */
export function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

// -------------------------------------------------------------- the canvas

async function decode(source: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source)
  } catch {
    throw new Error("That image couldn't be read. Try a JPEG or PNG.")
  }
}

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("That image couldn't be saved."))),
      type,
      quality,
    )
  })
}

/**
 * Shrink to fit MAX_EDGE and re-encode as JPEG.
 *
 * PNG screenshots of text are left alone — re-encoding flat colour and sharp
 * type as JPEG is how a readable screenshot turns into a smeary one — unless
 * they are genuinely huge, where the smearing is the lesser problem.
 */
export async function compressImage(file: File): Promise<Blob> {
  const keepPng = file.type === 'image/png' && file.size < 1_500_000
  const bitmap = await decode(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))

  if (scale === 1 && (keepPng || file.type === 'image/jpeg') && file.size < 1_200_000) {
    bitmap.close()
    return file
  }

  const canvas = canvasOf(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return file
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return toBlob(canvas, keepPng ? 'image/png' : 'image/jpeg', QUALITY)
}

// --------------------------------------------------------------- the scan

/**
 * Make a photo of a document read like a scan of one.
 *
 * The problem with a phone photo of paper is never the paper — it is the
 * light: one corner in shadow, a hand's silhouette across the middle, the
 * page grey rather than white. Cranking contrast globally makes the dark
 * corner black and the bright corner blank.
 *
 * So the shading is estimated first — a heavy box blur is, to a good enough
 * approximation, the lighting with the text averaged out of it — and every
 * pixel is divided by its own local brightness. Ink stays dark because it is
 * dark *relative to the paper beside it*, wherever that paper happens to sit.
 * The box blur runs off an integral image, so the window size costs nothing.
 */
export async function scanFilter(source: Blob): Promise<Blob> {
  const bitmap = await decode(source)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = canvasOf(width, height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    bitmap.close()
    return source
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const image = context.getImageData(0, 0, width, height)
  const pixels = image.data
  const count = width * height

  const grey = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const at = i * 4
    // Rec. 601 luma: green carries most of what the eye calls brightness.
    grey[i] = 0.299 * pixels[at] + 0.587 * pixels[at + 1] + 0.114 * pixels[at + 2]
  }

  // Integral image, one row of padding, so any box sum is four lookups.
  const integral = new Float64Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0
    for (let x = 0; x < width; x += 1) {
      rowSum += grey[y * width + x]
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + rowSum
    }
  }

  // A window wide enough to contain paper as well as ink; too small and the
  // filter starts treating the inside of a thick letter as its own page.
  const radius = Math.max(8, Math.round(Math.max(width, height) / 24))

  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius)
    const bottom = Math.min(height - 1, y + radius)
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius)
      const right = Math.min(width - 1, x + radius)
      const area = (bottom - top + 1) * (right - left + 1)
      const sum =
        integral[(bottom + 1) * (width + 1) + right + 1] -
        integral[top * (width + 1) + right + 1] -
        integral[(bottom + 1) * (width + 1) + left] +
        integral[top * (width + 1) + left]
      const local = sum / area

      // 1.0 means "as bright as its surroundings" — paper. Below that is ink.
      const ratio = grey[y * width + x] / Math.max(local, 1)
      // Pull the paper to white and stretch the gap just below it, where the
      // difference between faint pencil and a smudge actually lives.
      let value = (ratio - 0.82) / 0.18
      value = value < 0 ? 0 : value > 1 ? 1 : value
      const out = Math.round(255 * value * value * (3 - 2 * value))

      const at = (y * width + x) * 4
      pixels[at] = out
      pixels[at + 1] = out
      pixels[at + 2] = out
      pixels[at + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)
  return toBlob(canvas, 'image/jpeg', 0.88)
}

// --------------------------------------------------------------- storage

/** Put a chosen file away and hand back the record's half of it. */
export async function saveFile(
  file: File,
  options: { scan?: boolean; name?: string } = {},
): Promise<Attachment> {
  if (file.size > MAX_FILE) {
    throw new Error(`${file.name} is ${prettySize(file.size)}. The limit is 25 MB.`)
  }

  let blob: Blob = file
  let kind: Attachment['kind'] = 'file'

  if (isImage(file.type)) {
    kind = options.scan ? 'scan' : 'image'
    try {
      blob = options.scan ? await scanFilter(file) : await compressImage(file)
    } catch {
      // A format the canvas cannot decode (HEIC on some browsers, a broken
      // file) is still worth keeping — as itself, unprocessed.
      blob = file
      kind = 'file'
    }
  }

  const id = newFileId()
  await idbPut(FILES, id, blob)
  return {
    id,
    name: options.name ?? file.name ?? 'Attachment',
    type: blob.type || file.type || 'application/octet-stream',
    size: blob.size,
    kind,
    addedAt: new Date().toISOString(),
    text: null,
  }
}

/** Store a blob the app itself made — a camera frame, a re-scan. */
export async function saveBlob(
  blob: Blob,
  name: string,
  kind: Attachment['kind'] = 'scan',
): Promise<Attachment> {
  const id = newFileId()
  await idbPut(FILES, id, blob)
  return {
    id,
    name,
    type: blob.type || 'image/jpeg',
    size: blob.size,
    kind,
    addedAt: new Date().toISOString(),
    text: null,
  }
}

export function readFile(id: string): Promise<Blob | undefined> {
  return idbGet<Blob>(FILES, id)
}

export async function deleteFiles(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await idbDelete(FILES, id)
    } catch {
      // A blob that will not delete is wasted space, not a failure worth
      // stopping a save for.
    }
  }
}

export function readFileAsDataUrl(id: string): Promise<string | null> {
  return readFile(id).then((blob) => (blob ? blobToDataUrl(blob) : null))
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("That attachment couldn't be read."))
    reader.readAsDataURL(blob)
  })
}

export async function writeFileFromDataUrl(id: string, dataUrl: string): Promise<void> {
  const response = await fetch(dataUrl)
  await idbPut(FILES, id, await response.blob())
}

/**
 * Drop blobs no record points at any more.
 *
 * Deletes are already done inline when an item is edited or removed, so this
 * is the backstop for the paths that cannot be: a restore that replaced the
 * whole notebook, or a write that failed halfway.
 */
export async function sweepFiles(usedIds: string[]): Promise<number> {
  const used = new Set(usedIds)
  const stored = await idbKeys(FILES)
  const orphans = stored.filter((id) => !used.has(id))
  await deleteFiles(orphans)
  return orphans.length
}
