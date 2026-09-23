/**
 * Speed bumps on the way to the browser's developer tools, on the built site.
 *
 * Asked for so that a visitor cannot open the page and start changing it, and
 * worth being exact about what that buys. **This is not a lock.** A page
 * cannot stop the person holding the browser: the tools are one menu away
 * (⋮ → More tools → Developer tools), `view-source:` shows every script, and
 * turning JavaScript off turns this off with it. What it does is take away the
 * three habits — F12, Ctrl+Shift+I, right-click → Inspect — that most people
 * reach for first, so the page does not *invite* editing.
 *
 * Nor is it what protects anything. A visitor who does get the tools open is
 * editing their own copy of the page, in their own browser, over their own
 * empty notebook; nothing they change reaches anybody else's. The protection
 * for the notebook is elsewhere: `sanitize.ts` for anything imported or read
 * off disk, and the security policy in vite.config.ts for code that is not
 * ours.
 *
 * Held back deliberately:
 *
 * - Right-click is only refused for a **mouse**, and never on a text field, a
 *   link, a picture or selected text. A phone's long-press is the same event,
 *   and taking it away would take away copying a booking reference out of a
 *   note — on the device this notebook is mostly used on.
 * - Nothing watches the page for edits and puts them back. Browser
 *   translation, password managers and spell-checkers all edit the page too,
 *   and a guard that reverted them would fight the owner's own browser.
 * - Nothing detects an open console and blanks the page. The tests for it
 *   guess from window sizes, and they misfire on a docked side panel or a
 *   zoomed window, which is the owner's problem, not a visitor's.
 */

/** Keys that open the tools or the page source, by physical key. */
function opensTools(event: KeyboardEvent): boolean {
  if (event.key === 'F12') return true
  // `code` rather than `key`: on a Mac, Option turns 'i' into 'ˆ'.
  const letter = /^Key([A-Z])$/.exec(event.code)?.[1] ?? ''
  const { ctrlKey: ctrl, metaKey: cmd, shiftKey: shift, altKey: alt } = event
  return (
    // Windows and Linux: Ctrl+Shift+I, J, C; view source is Ctrl+U. Never
    // Ctrl+Alt — that is AltGr, which types letters on half of Europe.
    (ctrl && shift && !alt && ['I', 'J', 'C'].includes(letter)) ||
    (ctrl && !shift && !alt && letter === 'U') ||
    // Mac: ⌘⌥I, J, C, U, and ⌘⇧C for the element picker.
    (cmd && alt && ['I', 'J', 'C', 'U'].includes(letter)) ||
    (cmd && shift && letter === 'C')
  )
}

/** Right-clicks that are left alone: anything a person would right-click on purpose. */
function wantedMenu(event: MouseEvent): boolean {
  // A long-press arrives as `contextmenu` too. Only a mouse is refused.
  const pointer = (event as PointerEvent).pointerType
  if (pointer !== 'mouse') return true
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('input, textarea, select, [contenteditable], a[href], img')) return true
  return Boolean(window.getSelection()?.toString())
}

export function installSpeedBumps(): void {
  window.addEventListener(
    'keydown',
    (event) => {
      if (opensTools(event)) event.preventDefault()
    },
    true,
  )
  window.addEventListener(
    'contextmenu',
    (event) => {
      if (!wantedMenu(event)) event.preventDefault()
    },
    true,
  )

  // The one thing the console can do to this notebook is what its owner
  // pastes into it. Code typed there runs as the app, with every record in
  // reach, and "paste this into the console" is how that gets asked for.
  console.log(
    '%cStop.%c\nThis is a browser tool for developers. If someone asked you to paste something here, ' +
      'it is a trick: whatever you paste can read and send away your whole SchedulePlan notebook.',
    'color:#dc2626;font-size:28px;font-weight:700',
    'font-size:14px',
  )
}
