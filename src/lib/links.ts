/**
 * Links that are safe to put in an `href`.
 *
 * An anchor is somewhere code can run: `javascript:alert(1)` in an href is a
 * script, not an address, and so is a `data:` URL carrying a document. Nothing
 * here comes from a stranger — it is a link the owner of the notebook pasted
 * in themselves — but the notebook is also a file that gets exported, mailed
 * around and imported again, and "it was fine when I typed it" stops being
 * true at that point.
 *
 * So the scheme is checked when a link is *stored*, not when it is drawn. One
 * gate, on the way in, and everything downstream can treat a stored link as an
 * address.
 */

/** The link as it should be saved, or null if it cannot be made into one. */
export function safeUrl(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null

  // 'youtube.com/watch?v=x' is what people paste; a scheme is what URL needs.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    // A scheme and a dot. Without the second, 'notes' becomes
    // 'https://notes', which is a valid URL and not a link to anything.
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

/**
 * What to call a link with no label: 'youtube.com', 'drive.google.com'.
 * Enough to tell a vlog from a booking at a glance.
 */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
