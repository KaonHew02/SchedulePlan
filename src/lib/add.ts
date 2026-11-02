/**
 * The + in the middle of the phone's tab bar.
 *
 * On a laptop each screen keeps its own round add button in the corner. On a
 * phone that button moves into the tab bar, where the thumb already is, and
 * does whatever the corner button would have done: on Schedule it adds to the
 * schedule, on Reminders it adds a reminder.
 *
 * A screen says what its + does by drawing `<Fab>`, as it always has; Fab
 * registers the action here and the tab bar reads it. A screen with nothing of
 * its own to add — Currency, Translate, Seasons, Settings, and Travel, whose
 * trips are schedule items — leaves the + to its default: a new schedule item.
 * That means changing to Schedule first, and the form can only open once
 * Schedule has drawn its Fab, so the wish is held as `pending` until it does.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react'

interface Action {
  label: string
  run: () => void
}

/** Every Fab on screen, newest last. There is one, but nothing breaks if there are two. */
const stack: { current: Action }[] = []
let pending = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Called by Fab. The ref keeps the newest onClick without re-registering on every render. */
export function useAddAction(label: string, run: () => void): void {
  const ref = useRef<Action>({ label, run })
  ref.current = { label, run }

  useEffect(() => {
    stack.push(ref)
    emit()
    if (pending) {
      pending = false
      ref.current.run()
    }
    return () => {
      const at = stack.lastIndexOf(ref)
      if (at >= 0) stack.splice(at, 1)
      emit()
    }
  }, [])
}

/**
 * The tab bar's +. With no Fab on screen, `toSchedule` changes screens and
 * Schedule's Fab, arriving, opens the form. A wish left unanswered for a
 * second is dropped, so it can never fire later on its own.
 */
export function pressAdd(toSchedule: () => void): void {
  const top = stack[stack.length - 1]
  if (top) {
    top.current.run()
    return
  }
  pending = true
  toSchedule()
  setTimeout(() => {
    pending = false
  }, 1000)
}

/** What the + will do, for its label. Null when it falls back to Schedule. */
export function useAddLabel(): string | null {
  return useSyncExternalStore(subscribe, () => stack[stack.length - 1]?.current.label ?? null)
}
