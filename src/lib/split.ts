/**
 * Splitting a bill, and settling up afterwards.
 *
 * The model is *what each person had*, not *how to divide each item*. A line
 * belongs to the person who ate it; anything the table shared goes on its own
 * card and divides across everyone. That one decision is why there is no
 * split-method here and never needs to be:
 *
 *   an even split      the same figure on every person's line
 *   a lump per person  one unlabelled line each
 *   a percentage       type the money it comes to
 *
 * Two problems, and the second is the interesting one.
 *
 * Dividing is easy until money refuses to divide: RM 10 between three people
 * is 3.33 each and one lost cent. Handing everyone 3.33 loses it, and rounding
 * everyone up invents one. So the remainder is dealt out a cent at a time,
 * which keeps the shares summing to exactly what was paid.
 *
 * Settling is the real work. Whoever paid is owed by everybody else, and the
 * question is how few handovers clear it. With one payer that is one handover
 * per guest; the algorithm is general because netting is what makes the odd
 * sen land somewhere rather than nowhere.
 */

import type { BillSplit, SplitLine, SplitPerson } from '../types'

/** Work in whole cents. Floating point and money are a bad pairing. */
const toCents = (amount: number): number => Math.round(amount * 100)
const toAmount = (cents: number): number => cents / 100

/**
 * Divide `cents` between `count` people, remainder first-come.
 *
 * Somebody has to take the extra cent; giving it to the earliest names is
 * arbitrary but it is consistent, and consistency is what stops the totals
 * moving every time the screen redraws.
 */
export function divideCents(cents: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(cents / count)
  const remainder = cents - base * count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

export const ownLines = (split: BillSplit, id: string): SplitLine[] =>
  split.lines.filter((line) => line.person === id)

export const sharedLines = (split: BillSplit): SplitLine[] =>
  split.lines.filter((line) => line.person === null)

export interface Position {
  person: SplitPerson
  /** Their own lines, added up. */
  own: number
  /** Their part of everything on the shared card. */
  shared: number
  /** What was theirs to pay: own + shared. */
  had: number
  /** What they put down. Only the payer puts anything down. */
  paid: number
  /** Positive: they are owed this. Negative: they owe it. */
  net: number
}

/** What each person had, and where that leaves them. */
export function positions(split: BillSplit): Position[] {
  const own = new Map<string, number>()
  const shared = new Map<string, number>()
  for (const person of split.people) {
    own.set(person.id, 0)
    shared.set(person.id, 0)
  }

  for (const line of split.lines) {
    const cents = toCents(line.amount)
    if (line.person === null) {
      // Shared: divided across everyone, a cent at a time so it adds back.
      const parts = divideCents(cents, split.people.length)
      split.people.forEach((person, index) => {
        shared.set(person.id, (shared.get(person.id) ?? 0) + parts[index])
      })
    } else if (own.has(line.person)) {
      own.set(line.person, (own.get(line.person) ?? 0) + cents)
    }
  }

  const totalCents = toCents(splitTotal(split))

  return split.people.map((person) => {
    const ownCents = own.get(person.id) ?? 0
    const sharedCents = shared.get(person.id) ?? 0
    const hadCents = ownCents + sharedCents
    const paidCents = person.id === split.paidBy ? totalCents : 0
    return {
      person,
      own: toAmount(ownCents),
      shared: toAmount(sharedCents),
      had: toAmount(hadCents),
      paid: toAmount(paidCents),
      net: toAmount(paidCents - hadCents),
    }
  })
}

export interface Transfer {
  from: SplitPerson
  to: SplitPerson
  amount: number
}

/**
 * The payments that settle everyone up, fewest first.
 *
 * Greedy, and deliberately so: repeatedly make the person who owes most pay
 * the person who is owed most, as much as the smaller of the two allows. Each
 * pass zeroes at least one person, so with n people it never needs more than
 * n-1 transfers. With one payer that is exactly one handover per guest, which
 * is the shortest list there is.
 */
export function settle(split: BillSplit): Transfer[] {
  const owed = positions(split)
    .map((position) => ({ person: position.person, cents: toCents(position.net) }))
    .filter((row) => row.cents !== 0)

  const creditors = owed.filter((row) => row.cents > 0).sort((a, b) => b.cents - a.cents)
  const debtors = owed.filter((row) => row.cents < 0).sort((a, b) => a.cents - b.cents)

  const transfers: Transfer[] = []
  let credit = 0
  let debt = 0

  while (credit < creditors.length && debt < debtors.length) {
    const taking = creditors[credit]
    const paying = debtors[debt]
    const amount = Math.min(taking.cents, -paying.cents)

    if (amount > 0) {
      transfers.push({ from: paying.person, to: taking.person, amount: toAmount(amount) })
      taking.cents -= amount
      paying.cents += amount
    }

    if (taking.cents === 0) credit += 1
    if (paying.cents === 0) debt += 1
  }

  return transfers
}

/**
 * What the bill comes to.
 *
 * Added up from the lines, never typed. A total field would give the bill two
 * answers and no way to say which one is wrong.
 */
export const splitTotal = (split: BillSplit): number =>
  toAmount(split.lines.reduce((sum, line) => sum + toCents(line.amount), 0))

/** What each person pays for one shared line. */
export const sharedEach = (amount: number, people: number): number =>
  people > 0 ? toAmount(divideCents(toCents(amount), people)[0]) : 0

export function newPersonId(taken: string[]): string {
  let index = 1
  while (taken.includes(`p${index}`)) index += 1
  return `p${index}`
}

export function newLineId(taken: string[]): string {
  let index = 1
  while (taken.includes(`l${index}`)) index += 1
  return `l${index}`
}
