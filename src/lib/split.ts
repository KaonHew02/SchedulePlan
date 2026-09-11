/**
 * Splitting a bill, and settling up afterwards.
 *
 * Two problems, and the second is the interesting one.
 *
 * Dividing is easy until money refuses to divide: RM 10 between three people
 * is 3.33 each and one lost cent. Handing everyone 3.33 loses it, and rounding
 * everyone up invents one. So the remainder is dealt out a cent at a time,
 * which keeps the shares summing to exactly what was paid.
 *
 * Settling is the real work. Four people who have each paid for something are
 * owed and owing all at once, and the naive answer — everybody pays everybody
 * their share — is a dozen transfers for a weekend away. What matters is only
 * each person's *net* position, and from there the question is how few
 * transfers can flatten it.
 */

import type { BillSplit, SplitEntry, SplitPerson } from '../types'

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

export interface Position {
  person: SplitPerson
  /** What they put in. */
  paid: number
  /** What was theirs to pay. */
  owed: number
  /** Positive: they are owed this. Negative: they owe it. */
  net: number
}

/** Who paid what, who owed what, per person. */
export function positions(split: BillSplit): Position[] {
  const paid = new Map<string, number>()
  const owed = new Map<string, number>()
  for (const person of split.people) {
    paid.set(person.id, 0)
    owed.set(person.id, 0)
  }

  for (const entry of split.entries) {
    const cents = toCents(entry.amount)
    if (paid.has(entry.paidBy)) paid.set(entry.paidBy, (paid.get(entry.paidBy) ?? 0) + cents)

    if (entry.custom) {
      // Typed in by hand, so it is taken as given — including when it does
      // not add up, which the screen flags rather than silently "fixing".
      for (const [id, amount] of Object.entries(entry.custom)) {
        if (owed.has(id)) owed.set(id, (owed.get(id) ?? 0) + toCents(amount))
      }
      continue
    }

    const sharers = entry.shares.length
      ? split.people.filter((person) => entry.shares.includes(person.id))
      : split.people
    const parts = divideCents(cents, sharers.length)
    sharers.forEach((person, index) => {
      owed.set(person.id, (owed.get(person.id) ?? 0) + parts[index])
    })
  }

  return split.people.map((person) => {
    const paidCents = paid.get(person.id) ?? 0
    const owedCents = owed.get(person.id) ?? 0
    return {
      person,
      paid: toAmount(paidCents),
      owed: toAmount(owedCents),
      net: toAmount(paidCents - owedCents),
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
 * n-1 transfers — and for the sizes a bill split actually comes in, that is
 * the minimum or within one of it. Finding the true minimum every time is an
 * NP-hard problem, and nobody splitting a dinner needs it solved exactly.
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

export const splitTotal = (split: BillSplit): number =>
  toAmount(split.entries.reduce((sum, entry) => sum + toCents(entry.amount), 0))

/** An entry split by hand whose parts do not add up to it. */
export function customMismatch(entry: SplitEntry): number | null {
  if (!entry.custom) return null
  const parts = Object.values(entry.custom).reduce((sum, amount) => sum + toCents(amount), 0)
  const difference = toCents(entry.amount) - parts
  return difference === 0 ? null : toAmount(difference)
}

export function newPersonId(taken: string[]): string {
  let index = 1
  while (taken.includes(`p${index}`)) index += 1
  return `p${index}`
}

export function newEntryId(taken: string[]): string {
  let index = 1
  while (taken.includes(`e${index}`)) index += 1
  return `e${index}`
}
