import { useMemo, useState } from 'react'
import CurrencySelect from '../components/CurrencySelect'
import EmptyState from '../components/EmptyState'
import { DateField, Field } from '../components/FormFields'
import { ChevronLeft, ChevronRight, Close, Plus, TrashIcon } from '../components/Icons'
import { shortDate, todayISO } from '../lib/date'
import { effectiveRates, money, plain, rateBetween, rateLine, readCache } from '../lib/currency'
import {
  newLineId,
  newPersonId,
  ownLines,
  positions,
  settle,
  sharedEach,
  sharedLines,
  splitTotal,
} from '../lib/split'
import {
  createExpense,
  deleteSplit,
  newSplitId,
  saveSplit,
  updateExpense,
  useExpenses,
  useSettings,
  useSplits,
} from '../lib/store'
import type { BillSplit, SplitLine } from '../types'

/**
 * Splitting a bill between people.
 *
 * The model is **what each person had**, not how to divide each item. A line
 * sits under the person who ate it, anything the table shared goes on its own
 * card, and the bill total is the sum of the lines — which is why there is no
 * total field on this screen and no split-method picker. An even split is the
 * same figure on every row; a lump per person is one unlabelled line each.
 *
 * It was rebuilt on that shape on 2026-09-11. The version before it asked
 * "here is an item — who paid for it, and who shares it?", which needed
 * *Evenly / By amount* modes and a chip row on every item, and still could not
 * say what a bill came to for one person without adding it up in your head.
 *
 * It lives inside Expenses rather than behind More because the answer it
 * produces — what did this cost me — is an expense, and `ShareCard` is where
 * it stops being a calculation and becomes one.
 */

/** A fresh bill, saved immediately so the editor has something to open. */
export function createSplit(currency: string): BillSplit {
  const split: BillSplit = {
    id: newSplitId(),
    title: '',
    date: todayISO(),
    currency,
    people: [{ id: 'p1', name: 'Me' }],
    lines: [],
    paidBy: 'p1',
    expense_id: null,
    expense_person: null,
  }
  saveSplit(split)
  return split
}

/**
 * The first person on a bill is the reader, and a sentence has to say so.
 * Left alone, the default name produces "Me had RM 50" and "ME'S SHARE".
 */
const sayName = (name: string): string => (name === 'Me' ? 'You' : name)

/**
 * One line, edited in place.
 *
 * The amount is held as the text that was typed rather than re-rendered from
 * the number: `10.` parses to 10, and a field that erases your decimal point
 * the moment you type it cannot be used.
 */
function LineRow({
  line,
  currency,
  each,
  onChange,
  onRemove,
}: {
  line: SplitLine
  currency: string
  /** What each person pays for this line — the shared card only. */
  each: number | null
  onChange: (line: SplitLine) => void
  onRemove: () => void
}) {
  const [amount, setAmount] = useState(line.amount ? String(line.amount) : '')

  return (
    <div className="flex items-center gap-2 border-t border-neutral-100 py-1.5">
      <input
        value={line.label}
        onChange={(event) => onChange({ ...line, label: event.target.value })}
        placeholder="What was it?"
        aria-label="What this line was"
        className="min-w-0 flex-1 bg-transparent py-1 text-[14px] outline-none placeholder:text-neutral-300"
      />
      {each !== null && line.amount > 0 && (
        <span className="shrink-0 text-[12px] tabular-nums text-neutral-400">
          {plain(each, currency)} ea
        </span>
      )}
      <input
        value={amount}
        onChange={(event) => {
          setAmount(event.target.value)
          onChange({ ...line, amount: Number(event.target.value) || 0 })
        }}
        inputMode="decimal"
        placeholder="0.00"
        aria-label="Amount"
        className="w-20 shrink-0 bg-transparent py-1 text-right text-[14px] tabular-nums outline-none placeholder:text-neutral-300"
      />
      <button
        onClick={onRemove}
        aria-label="Remove this line"
        className="shrink-0 rounded-full p-1 text-neutral-300 hover:bg-neutral-100 hover:text-neutral-500"
      >
        <Close className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** A card of lines: one person's, or the shared one. */
function LineCard({
  title,
  badge,
  total,
  currency,
  lines,
  people,
  hint,
  onAdd,
  onChange,
  onRemove,
  onRemoveCard,
}: {
  title: string
  badge?: string
  total: number
  currency: string
  lines: SplitLine[]
  /** How many ways a line on this card divides. 1 on a person's own card. */
  people: number
  hint?: string
  onAdd: () => void
  onChange: (line: SplitLine) => void
  onRemove: (id: string) => void
  onRemoveCard?: () => void
}) {
  return (
    <div className="mt-2.5 rounded-2xl border border-neutral-200 px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span className="truncate text-[13px] font-semibold uppercase tracking-wide">{title}</span>
        {badge && (
          <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
            {badge}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[15px] font-semibold tabular-nums">
          {plain(total, currency)}
        </span>
        {onRemoveCard && (
          <button
            onClick={onRemoveCard}
            aria-label={`Remove ${title}`}
            className="shrink-0 rounded-full p-1 text-neutral-300 hover:bg-neutral-100 hover:text-neutral-500"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {lines.map((line) => (
        <LineRow
          key={line.id}
          line={line}
          currency={currency}
          each={people > 1 ? sharedEach(line.amount, people) : null}
          onChange={onChange}
          onRemove={() => onRemove(line.id)}
        />
      ))}

      {lines.length === 0 && hint && (
        <p className="border-t border-neutral-100 pt-2 text-[12px] leading-5 text-neutral-400">
          {hint}
        </p>
      )}

      <button
        onClick={onAdd}
        className="mt-1.5 flex items-center gap-1 text-[13px] font-medium text-brand-500"
      >
        <Plus className="h-3.5 w-3.5" />
        Add item
      </button>
    </div>
  )
}

/**
 * One person's share of the bill, and the button that puts it in the
 * spending list.
 *
 * It is a **link**, not a copy: the expense's id is kept on the bill, so a
 * second tap updates that expense rather than adding another one. A bill
 * grows a line at a time — the share after dessert is not the share after the
 * taxi — and a copy-per-tap would leave four versions of one dinner in a
 * month's total.
 *
 * What the expense is recorded in is the home currency, with the bill's own
 * currency and the rate frozen alongside it, exactly as a hand-entered foreign
 * expense is. So this needs a rate, and says so plainly when there isn't one
 * rather than inventing a number.
 */
function ShareCard({
  split,
  onChange,
  onToast,
}: {
  split: BillSplit
  onChange: (split: BillSplit) => void
  onToast: (message: string) => void
}) {
  const settings = useSettings()
  const expenses = useExpenses()
  const [busy, setBusy] = useState(false)

  const home = settings.currency
  const rows = useMemo(() => positions(split), [split])

  // A person can be removed after being picked, so the stored choice is a
  // preference, not a guarantee.
  const chosen = rows.find((row) => row.person.id === split.expense_person) ?? rows[0]

  const rates = useMemo(
    () => effectiveRates(readCache(), settings.manualRates),
    [settings.manualRates],
  )
  const foreign = split.currency !== home
  const rate = rateBetween(rates, split.currency, home)

  const share = chosen?.had ?? 0
  const amount = foreign ? (rate === null ? null : share * rate) : share

  const linked = expenses.find((expense) => expense.id === split.expense_id) ?? null
  const stale =
    linked !== null &&
    amount !== null &&
    (Math.abs(linked.amount - Math.round(amount * 100) / 100) > 0.005 ||
      linked.date !== split.date)

  async function push() {
    if (!chosen || amount === null) return
    setBusy(true)
    try {
      const draft = {
        date: split.date,
        title: split.title.trim() || 'Bill split',
        amount,
        currency: home,
        // Everything the reader may have set on the expense by hand survives
        // an update — only the numbers this screen owns are rewritten.
        category: linked?.category ?? null,
        original_amount: foreign ? share : null,
        original_currency: foreign ? split.currency : null,
        exchange_rate: foreign ? rate : null,
        schedule_id: linked?.schedule_id ?? null,
        notes: linked?.notes ?? `${chosen.person.name}'s share, split ${split.people.length} ways`,
        attachments: linked?.attachments ?? [],
      }

      if (linked) {
        await updateExpense(linked.id, draft)
        onChange({ ...split, expense_person: chosen.person.id })
        onToast('Expense updated')
      } else {
        const expense = await createExpense(draft)
        onChange({ ...split, expense_id: expense.id, expense_person: chosen.person.id })
        onToast('Added to expenses')
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not save that expense.')
    } finally {
      setBusy(false)
    }
  }

  if (!chosen) return null

  return (
    <>
      <h2 className="pb-2 pt-6 text-[13px] font-medium text-neutral-400">
        Put it in your expenses
      </h2>
      <div className="rounded-2xl border border-neutral-200 p-4">
        {split.people.length > 1 && (
          <div className="flex flex-wrap gap-2 pb-3">
            {split.people.map((person) => (
              <button
                key={person.id}
                onClick={() => onChange({ ...split, expense_person: person.id })}
                className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                  person.id === chosen.person.id
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 text-neutral-600'
                }`}
              >
                {person.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] text-neutral-500">
            {sayName(chosen.person.name)} had {plain(chosen.had, split.currency)} of it
          </span>
          <span className="text-[19px] font-semibold tabular-nums">
            {amount === null ? <span className="text-neutral-300">—</span> : money(amount, home)}
          </span>
        </div>

        {foreign && rate !== null && (
          <p className="pt-1 text-[12px] leading-5 text-neutral-400">
            {rateLine(split.currency, home, rate)} — frozen into the expense, the way a receipt in
            a foreign currency is.
          </p>
        )}

        {foreign && rate === null ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-3 text-[13px] leading-5 text-amber-800">
            No rate for {split.currency} to {home} yet. Open Currency, refresh, and come back — or
            set the rate you actually got.
          </p>
        ) : share <= 0 ? (
          <p className="mt-3 text-[13px] leading-5 text-neutral-400">
            {sayName(chosen.person.name)} had nothing on this bill, so there is nothing to
            record.
          </p>
        ) : (
          <>
            <button
              onClick={() => void push()}
              disabled={busy || (linked !== null && !stale)}
              className="mt-4 w-full rounded-full bg-brand-500 py-2.5 text-[14px] font-medium text-white disabled:opacity-40"
            >
              {linked === null
                ? 'Add to expenses'
                : stale
                  ? 'Update the expense'
                  : 'In your expenses'}
            </button>
            {linked !== null && (
              <p className="pt-2 text-center text-[12px] leading-5 text-neutral-400">
                {stale
                  ? `Recorded as ${money(linked.amount, linked.currency)} on ${shortDate(linked.date)} — this has moved since.`
                  : `Recorded on ${shortDate(linked.date)}. Deleting it there does not touch the bill.`}
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}

export function SplitEditor({
  initial,
  onClose,
  onToast,
}: {
  initial: BillSplit
  onClose: () => void
  onToast: (message: string) => void
}) {
  const [split, setSplit] = useState<BillSplit>(initial)
  const [newName, setNewName] = useState('')

  const total = splitTotal(split)
  const rows = useMemo(() => positions(split), [split])
  const transfers = useMemo(() => settle(split), [split])
  const shared = sharedLines(split)
  const you = rows[0]
  const payer = split.people.find((person) => person.id === split.paidBy)

  function change(next: BillSplit) {
    setSplit(next)
    saveSplit(next)
  }

  const setLines = (lines: SplitLine[]) => change({ ...split, lines })

  function addLine(person: string | null) {
    setLines([
      ...split.lines,
      { id: newLineId(split.lines.map((line) => line.id)), label: '', amount: 0, person },
    ])
  }

  const editLine = (line: SplitLine) =>
    setLines(split.lines.map((row) => (row.id === line.id ? line : row)))

  const dropLine = (id: string) => setLines(split.lines.filter((row) => row.id !== id))

  function addPerson() {
    const name = newName.trim()
    if (!name) return
    change({
      ...split,
      people: [...split.people, { id: newPersonId(split.people.map((p) => p.id)), name }],
    })
    setNewName('')
  }

  function removePerson(id: string) {
    // Their lines go with them — a line under nobody has no owner to charge.
    // The toast says how many that was rather than a dialog asking first.
    const person = split.people.find((row) => row.id === id)
    const theirs = ownLines(split, id).length
    const people = split.people.filter((row) => row.id !== id)
    change({
      ...split,
      people,
      lines: split.lines.filter((line) => line.person !== id),
      paidBy: split.paidBy === id ? (people[0]?.id ?? '') : split.paidBy,
      expense_person: split.expense_person === id ? null : split.expense_person,
    })
    onToast(
      theirs === 0
        ? `${person?.name ?? 'They'} removed`
        : `${person?.name ?? 'They'} removed, with ${theirs} ${theirs === 1 ? 'line' : 'lines'}`,
    )
  }

  function owedNote(): string {
    if (Math.abs(you?.net ?? 0) < 0.005) return 'Nobody owes anything yet'
    if ((you?.net ?? 0) > 0) {
      const others = split.people.length - 1
      return `from ${others} ${others === 1 ? 'person' : 'people'}`
    }
    return `to ${payer?.name ?? 'whoever paid'}`
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-1 px-3 pb-3 pt-4 lg:px-6">
          <button onClick={onClose} aria-label="Back to bills" className="p-1.5 text-neutral-400">
            <ChevronLeft />
          </button>
          <input
            value={split.title}
            onChange={(event) => change({ ...split, title: event.target.value })}
            placeholder="What are you splitting?"
            aria-label="Bill name"
            className="min-w-0 flex-1 bg-transparent text-[19px] font-semibold tracking-tight outline-none placeholder:text-neutral-300"
          />
        </div>
      </header>

      <main className="px-5 pb-28 lg:px-8 lg:pb-10">
        {/*
          The three figures the whole screen exists to produce, above the
          working rather than below it. The total is added up from the lines
          and is deliberately not a field: a bill with a typed total *and* a
          list of lines has two answers and no way to say which is wrong.
        */}
        <div className="rounded-2xl border border-neutral-200 p-4 lg:p-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-neutral-400">
            Bill total
          </p>
          <p className="text-[30px] font-semibold tabular-nums tracking-tight lg:text-[34px]">
            {money(total, split.currency)}
          </p>
          <p className="text-[13px] text-neutral-400">
            {split.people.length} {split.people.length === 1 ? 'person' : 'people'}
            {payer ? ` · ${payer.name} paid` : ''}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-neutral-50 px-3.5 py-2.5">
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                Your share
              </p>
              <p className="text-[18px] font-semibold tabular-nums">
                {plain(you?.had ?? 0, split.currency)}
              </p>
              <p className="truncate text-[12px] text-neutral-400">
                {total === 0 ? 'Nothing on the bill yet' : `of ${plain(total, split.currency)}`}
              </p>
            </div>
            <div className="rounded-xl bg-neutral-50 px-3.5 py-2.5">
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                {(you?.net ?? 0) < -0.004 ? 'You owe' : 'Owed back'}
              </p>
              <p
                className={`text-[18px] font-semibold tabular-nums ${
                  (you?.net ?? 0) > 0.004
                    ? 'text-emerald-600'
                    : (you?.net ?? 0) < -0.004
                      ? 'text-red-600'
                      : ''
                }`}
              >
                {plain(Math.abs(you?.net ?? 0), split.currency)}
              </p>
              <p className="truncate text-[12px] text-neutral-400">{owedNote()}</p>
            </div>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10">
          <div>
            <div className="mt-6 divide-y divide-neutral-100 border-y border-neutral-100">
              <Field label="Date">
                <DateField value={split.date} onChange={(date) => change({ ...split, date })} />
              </Field>
              <Field label="Currency">
                <CurrencySelect
                  value={split.currency}
                  onChange={(currency) => change({ ...split, currency })}
                />
              </Field>
            </div>

            <h2 className="pb-2 pt-6 text-[13px] font-medium text-neutral-400">Who paid</h2>
            <div className="flex flex-wrap gap-2">
              {split.people.map((person) => (
                <button
                  key={person.id}
                  onClick={() => change({ ...split, paidBy: person.id })}
                  className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                    split.paidBy === person.id
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 text-neutral-600'
                  }`}
                >
                  {person.name}
                </button>
              ))}
            </div>

            <h2 className="pb-1 pt-6 text-[13px] font-medium text-neutral-400">Who was there</h2>
            {split.people.map((person, index) => (
              <LineCard
                key={person.id}
                title={person.name}
                badge={index === 0 ? 'you' : undefined}
                total={rows[index]?.own ?? 0}
                currency={split.currency}
                lines={ownLines(split, person.id)}
                people={1}
                hint="What they had. A line does not need a name — a single figure is fine."
                onAdd={() => addLine(person.id)}
                onChange={editLine}
                onRemove={dropLine}
                onRemoveCard={split.people.length > 1 ? () => removePerson(person.id) : undefined}
              />
            ))}

            <div className="mt-2.5 flex items-center gap-1 rounded-full border border-dashed border-neutral-300 py-1.5 pl-4 pr-1.5">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addPerson()
                  }
                }}
                placeholder="Add someone"
                aria-label="New person's name"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
              />
              <button
                onClick={addPerson}
                aria-label="Add this person"
                className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-100"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <h2 className="pb-1 pt-6 text-[13px] font-medium text-neutral-400">Shared</h2>
            <LineCard
              title="Shared by everyone"
              total={shared.reduce((sum, line) => sum + line.amount, 0)}
              currency={split.currency}
              lines={shared}
              people={split.people.length}
              hint="Rice, a jug, the plate of fries nobody counted. Only know the total? Put it here as one line."
              onAdd={() => addLine(null)}
              onChange={editLine}
              onRemove={dropLine}
            />
          </div>

          <div>
            <h2 className="pb-1 pt-6 text-[13px] font-medium text-neutral-400 lg:mt-6 lg:pt-0">
              Everyone pays
            </h2>
            {total === 0 ? (
              <p className="border-y border-neutral-100 py-4 text-[13px] leading-5 text-neutral-500">
                Put in what everyone had and the split works itself out.
              </p>
            ) : (
              <div className="divide-y divide-neutral-100 border-y border-neutral-100">
                {rows.map((row) => (
                  <div key={row.person.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[14px]">{row.person.name}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-neutral-400">
                      had {plain(row.had, split.currency)}
                      {row.shared > 0.004 && ` · ${plain(row.shared, split.currency)} shared`}
                    </span>
                    <span
                      className={`w-20 shrink-0 text-right text-[14px] font-medium tabular-nums ${
                        row.net > 0.004
                          ? 'text-emerald-600'
                          : row.net < -0.004
                            ? 'text-red-600'
                            : 'text-neutral-300'
                      }`}
                    >
                      {Math.abs(row.net) < 0.005
                        ? 'even'
                        : `${row.net > 0 ? '+' : '−'}${plain(Math.abs(row.net), split.currency)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <h2 className="pb-1 pt-6 text-[13px] font-medium text-neutral-400">Settle up</h2>
            {transfers.length === 0 ? (
              <p className="border-y border-neutral-100 py-4 text-[14px] text-neutral-500">
                {total === 0 ? 'Nothing to settle yet.' : 'Everyone is square. Nothing to pay.'}
              </p>
            ) : (
              <>
                <div className="divide-y divide-neutral-100 border-y border-neutral-100">
                  {transfers.map((transfer, index) => (
                    <div key={index} className="flex items-center gap-2 py-3">
                      <span className="text-[15px] font-medium">{transfer.from.name}</span>
                      <ChevronRight className="h-4 w-4 text-neutral-300" />
                      <span className="text-[15px] font-medium">{transfer.to.name}</span>
                      <span className="ml-auto text-[15px] tabular-nums">
                        {money(transfer.amount, split.currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="pt-2 text-[12px] leading-5 text-neutral-400">
                  {transfers.length} {transfers.length === 1 ? 'payment' : 'payments'} clears the
                  whole thing.
                </p>
              </>
            )}

            <ShareCard split={split} onChange={change} onToast={onToast} />

            <div className="pt-8">
              <button
                onClick={() => {
                  deleteSplit(split.id)
                  onToast('Bill deleted')
                  onClose()
                }}
                className="w-full rounded-full border border-neutral-200 py-3 text-[15px] font-medium text-red-600"
              >
                Delete this bill
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

/** The list under the Splits tab. Its header and add button belong to Expenses. */
export function SplitsList({ onOpen }: { onOpen: (id: number) => void }) {
  const splits = useSplits()
  const expenses = useExpenses()

  const ordered = useMemo(
    () => splits.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [splits],
  )

  return (
    <main className="px-5 pb-28 lg:max-w-3xl lg:px-8 lg:pb-10">
      {ordered.length === 0 ? (
        <EmptyState
          title="Nothing being split yet"
          hint="Tap + to put in who was there and what each of them had"
        />
      ) : (
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          {ordered.map((split) => {
            const inSpending = expenses.some((expense) => expense.id === split.expense_id)
            const yours = positions(split)[0]
            return (
              <button
                key={split.id}
                onClick={() => onOpen(split.id)}
                className="flex w-full items-center gap-3 py-3.5 text-left active:bg-neutral-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">
                    {split.title || 'Untitled bill'}
                  </span>
                  <span className="block truncate text-[12px] text-neutral-400">
                    {shortDate(split.date)} · {split.people.length} people · your share{' '}
                    {plain(yours?.had ?? 0, split.currency)}
                    {inSpending && <span className="text-brand-500"> · in your expenses</span>}
                  </span>
                </span>
                <span className="shrink-0 text-[15px] tabular-nums">
                  {plain(splitTotal(split), split.currency)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
              </button>
            )
          })}
        </div>
      )}
    </main>
  )
}
