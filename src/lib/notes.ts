/**
 * Notes laid out for the width they are shown at, not the width they arrived at.
 *
 * Text pasted into a note usually comes pre-broken. Whatever wrote it — a
 * phone note, a chat window, an editor — wrapped it at its own column, around
 * forty characters, and those newlines travel with the text. `whitespace-pre-
 * wrap` then honours every one of them, which is right for what it was added
 * for and wrong here: on a desktop card a thousand pixels across, a paragraph
 * broken at forty characters stops two thirds of the way along and leaves the
 * rest of the card blank. The card is not too wide; the text is wearing
 * somebody else's line breaks.
 *
 * Undoing them wholesale is not the answer either. An address, a phone number
 * and the opening hours are three lines because they are three things, and
 * running them into one grey sentence is exactly the damage `pre-wrap` was
 * brought in to stop.
 *
 * The two look different, though, and that is what this reads. Prose broken by
 * a wrapper has every line but the last running to the same edge — that is
 * what a wrapper does. A block of separate items has lines of whatever length
 * each item happens to be. So a run of lines is rejoined only when all of it
 * bar the last line is close to the longest; anything raggeder is left exactly
 * as typed. Blank lines separate one run from the next and are always kept.
 */

/** A CJK glyph takes two columns where a latin one takes one. */
const WIDE =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/

const columns = (line: string): number => {
  let width = 0
  for (const character of line) width += WIDE.test(character) ? 2 : 1
  return width
}

/**
 * How close to the longest line every other line has to be before the run
 * reads as something a wrapper produced rather than something somebody typed.
 * Loose enough that a wrap landing before a long word still counts, tight
 * enough that a phone number under an address does not.
 */
const FULL = 0.85

/** Two CJK characters meeting need no space between them; anything else does. */
function join(left: string, right: string): string {
  const last = left[left.length - 1] ?? ''
  const first = right[0] ?? ''
  return WIDE.test(last) && WIDE.test(first) ? left + right : `${left} ${right}`
}

export function reflow(notes: string): string {
  return notes
    .replace(/\r\n?/g, '\n')
    // A blank line is a break somebody meant. Runs between them are the
    // only thing in question.
    .split(/\n{2,}/)
    .map((run) => {
      const lines = run.split('\n')
      if (lines.length < 2) return run

      const widest = Math.max(...lines.map(columns))
      const wrapped = lines.slice(0, -1).every((line) => columns(line) >= widest * FULL)
      if (!wrapped) return run

      return lines.map((line) => line.trim()).reduce(join)
    })
    .join('\n\n')
}
