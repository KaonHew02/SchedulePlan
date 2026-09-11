import { useMemo, useState } from 'react'
import Confirm from '../components/Confirm'
import CurrencySelect from '../components/CurrencySelect'
import EmptyState from '../components/EmptyState'
import { DateField, Field, Segmented } from '../components/FormFields'
import { ChevronLeft, ChevronRight, Plus, TrashIcon } from '../components/Icons'
import Sheet from '../components/Sheet'
import { shortDate, todayISO } from '../lib/date'
import { effectiveRates, money, plain, rateBetween, rateLine, readCache } from '../lib/currency'
import {
  customMismatch,
  newEntryId,
  newPersonId,
  positions,
  settle,
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
import type { BillSplit, SplitEntry } from '../types'

/**
 * Splitting a bill between people who all paid for bits of it.
 *
 * It lives inside Expenses now rather than behind More, because the answer it
 * produces — *what did this cost me* — is an expense, and it used to stop one
 * step short of saying so. The share can be pushed into the spending list from
 * the bottom of the editor; see `ShareCard` for why that is a link rather than
 * a copy.
 *
 * The screen is built around the question that actually gets asked at the end
 * of a trip — *who owes whom* — rather than the one a spreadsheet answers,
 * which is what everything cost. See lib/split.ts for the arithmetic and for
 * why the settlement is greedy.
 */

/** A fresh split, saved immediately so the editor has something to open. */
export function createSplit(currency: string): BillSplit {
  const split: BillSplit = {
    id: newSplitId(),
    title: '',
    date: todayISO(),
    currency,
    people: [{ id: 'p1', name: 'Me' }],
    entries: [],
    expense_id: null,
    expense_person: null,
  }
  saveSplit(split)
  return split
}

function EntrySheet({
  split,
  entry,
  onClose,
  onSave,
  onDelete,
}: {
  split: BillSplit
  entry: SplitEntry | null
  onClose: () => void
  onSave: (entry: SplitEntry) => void
  onDelete?: () => void
}) {
  const [label, setLabel] = useState(entry?.label ?? '')
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '')
  const [paidBy, setPaidBy] = useState(entry?.paidBy ?? split.people[0]?.id ?? '')
  const [shares, setShares] = useState<string[]>(
    entry?.shares.length ? entry.shares : split.people.map((person) => person.id),
  )
  const [mode, setMode] = useState<'even' | 'exact'>(entry?.custom ? 'exact' : 'even')
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      split.people.map((person) => [person.id, entry?.custom?.[person.id]?.toString() ?? '']),
    ),
  )
  const [error, setError] = useState<string | null>(null)

  const total = Number(amount) || 0
  const exactSum = Object.values(custom).reduce((sum, value) => sum + (Number(value) || 0), 0)

  function submit() {
    if (!label.trim()) return setError('What was this for?')
    if (total <= 0) return setError('Enter an amount above zero.')
    if (mode === 'even' && shares.length === 0) return setError('Pick at least one person.')
    if (mode === 'exact' && Math.abs(exactSum - total) > 0.005) {
      return setError(
        `Those add up to ${plain(exactSum, split.currency)}, not ${plain(total, split.currency)}.`,
      )
    }

    onSave({
      id: entry?.id ?? newEntryId(split.entries.map((row) => row.id)),
      label: label.trim(),
      amount: total,
      paidBy,
      shares: mode === 'even' ? shares : split.people.map((person) => person.id),
      custom:
        mode === 'exact'
          ? Object.fromEntries(
              Object.entries(custom)
                .map(([id, value]) => [id, Number(value) || 0] as const)
                .filter(([, value]) => value !== 0),
            )
          : null,
    })
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
      active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-600'
    }`

  return (
    <Sheet
      onClose={onClose}
      title={entry ? 'Edit item' : 'Add an item'}
      footer={
        <>
          {error && <p className="mb-2.5 text-[13px] text-red-600">{error}</p>}
          <button
            type="button"
            onClick={submit}
            className="w-full rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white"
          >
            Save
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="mt-2 w-full rounded-full border border-neutral-200 py-3 text-[15px] font-medium text-red-600"
            >
              Remove
            </button>
          )}
        </>
      }
    >
      <input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        autoFocus={!entry}
        placeholder="What was it?"
        className="w-full bg-transparent py-1 text-[17px] outline-none placeholder:text-neutral-300"
      />

      <div className="mt-2 flex items-center gap-2 border-y border-neutral-100 py-3">
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          aria-label="Amount"
          placeholder="0.00"
          className="min-w-0 flex-1 bg-transparent text-[26px] font-semibold tabular-nums tracking-tight outline-none placeholder:text-neutral-200"
        />
        <span className="text-[15px] font-medium text-neutral-400">{split.currency}</span>
      </div>

      <p className="pb-2 pt-4 text-[13px] text-neutral-400">Paid by</p>
      <div className="flex flex-wrap gap-2">
        {split.people.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => setPaidBy(person.id)}
            className={chip(paidBy === person.id)}
          >
            {person.name}
          </button>
        ))}
      </div>

      <p className="pb-2 pt-4 text-[13px] text-neutral-400">Split</p>
      <Segmented
        value={mode}
        options={[
          { value: 'even', label: 'Evenly' },
          { value: 'exact', label: 'By amount' },
        ]}
        onChange={setMode}
      />

      {mode === 'even' ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {split.people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() =>
                  setShares((was) =>
                    was.includes(person.id)
                      ? was.filter((id) => id !== person.id)
                      : [...was, person.id],
                  )
                }
                className={chip(shares.includes(person.id))}
              >
                {person.name}
              </button>
            ))}
          </div>
          {shares.length > 0 && total > 0 && (
            <p className="pt-2 text-[13px] text-neutral-400">
              {plain(total / shares.length, split.currency)} each, across {shares.length}{' '}
              {shares.length === 1 ? 'person' : 'people'}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="mt-2 divide-y divide-neutral-100 border-y border-neutral-100">
            {split.people.map((person) => (
              <Field key={person.id} label={person.name}>
                <input
                  value={custom[person.id] ?? ''}
                  onChange={(event) =>
                    setCustom((was) => ({ ...was, [person.id]: event.target.value }))
                  }
                  inputMode="decimal"
                  aria-label={`${person.name}'s share`}
                  placeholder="0.00"
                  className="w-24 bg-transparent text-right text-[15px] tabular-nums outline-none placeholder:text-neutral-300"
                />
              </Field>
            ))}
          </div>
          <p
            className={`pt-2 text-[13px] ${
              Math.abs(exactSum - total) > 0.005 ? 'text-amber-600' : 'text-neutral-400'
            }`}
          >
            {plain(exactSum, split.currency)} of {plain(total, split.currency)} accounted for
          </p>
        </>
      )}
    </Sheet>
  )
}

/**
 * One person's share of the split, and the button that puts it in the
 * spending list.
 *
 * It is a **link**, not a copy: the expense's id is kept on the split, so a
 * second tap updates that expense rather than adding another one. A split
 * grows an item at a time — the share after dessert is not the share after
 * the taxi — and a copy-per-tap would leave four versions of the same dinner
 * in a month's total.
 *
 * What the expense is recorded in is the home currency, with the split's own
 * currency and the rate frozen alongside it, exactly as a hand-entered
 * foreign expense is. So this needs a rate, and says so plainly when there
 * isn't one rather than inventing a number.
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

  const share = chosen?.owed ?? 0
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
        // Everything the user may have set on the expense by hand survives an
        // update — only the numbers this screen owns are rewritten.
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
      <h2 className="pb-2 pt-6 text-[13px] font-medium text-neutral-400">Your share</h2>
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
            {chosen.person.name} used {plain(chosen.owed, split.currency)} of it
          </span>
          <span className="text-[19px] font-semibold tabular-nums">
            {amount === null ? (
              <span className="text-neutral-300">—</span>
            ) : (
              money(amount, home)
            )}
          </span>
        </div>

        {foreign && rate !== null && (
          <p className="pt-1 text-[12px] leading-5 text-neutral-400">
            {rateLine(split.currency, home, rate)} — frozen into the expense, the way a receipt
            in a foreign currency is.
          </p>
        )}

        {foreign && rate === null ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-3 text-[13px] leading-5 text-amber-800">
            No rate for {split.currency} to {home} yet. Open Currency, refresh, and come back —
            or set the rate you actually got.
          </p>
        ) : share <= 0 ? (
          <p className="mt-3 text-[13px] leading-5 text-neutral-400">
            {chosen.person.name} is not down for any of it, so there is nothing to record.
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
                  : `Recorded on ${shortDate(linked.date)}. Deleting it there does not touch the split.`}
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
  const [entrySheet, setEntrySheet] = useState<{ entry: SplitEntry | null } | null>(null)
  const [newName, setNewName] = useState('')
  const [removingPerson, setRemovingPerson] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const total = splitTotal(split)
  const rows = useMemo(() => positions(split), [split])
  const transfers = useMemo(() => settle(split), [split])

  function change(next: BillSplit) {
    setSplit(next)
    saveSplit(next)
  }

  function addPerson() {
    const name = newName.trim()
    if (!name) return
    change({
      ...split,
      people: [
        ...split.people,
        { id: newPersonId(split.people.map((person) => person.id)), name },
      ],
    })
    setNewName('')
  }

  function removePerson(id: string) {
    // Anything they paid for would become unattributable, so it goes with
    // them — but only after being told how much that is.
    change({
      ...split,
      people: split.people.filter((person) => person.id !== id),
      expense_person: split.expense_person === id ? null : split.expense_person,
      entries: split.entries
        .filter((entry) => entry.paidBy !== id)
        .map((entry) => ({
          ...entry,
          shares: entry.shares.filter((share) => share !== id),
          custom: entry.custom
            ? Object.fromEntries(Object.entries(entry.custom).filter(([key]) => key !== id))
            : null,
        })),
    })
    setRemovingPerson(null)
  }

  const owedBy = (id: string) => split.entries.filter((entry) => entry.paidBy === id).length
  const removingName = split.people.find((person) => person.id === removingPerson)?.name

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-1 px-3 pb-3 pt-4 lg:px-6">
          <button onClick={onClose} aria-label="Back to splits" className="p-1.5 text-neutral-400">
            <ChevronLeft />
          </button>
          <input
            value={split.title}
            onChange={(event) => change({ ...split, title: event.target.value })}
            placeholder="What are you splitting?"
            aria-label="Split name"
            className="min-w-0 flex-1 bg-transparent text-[19px] font-semibold tracking-tight outline-none placeholder:text-neutral-300"
          />
        </div>
      </header>

      {/*
        Two columns from a laptop up: what you are entering on the left, what
        it works out to on the right. Stacked, the settling-up — the whole
        point of the screen — sat below the fold of a list you were still
        adding to.
      */}
      <main className="px-5 pb-28 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:px-8 lg:pb-10">
        <div>
          <div className="divide-y divide-neutral-100 border-y border-neutral-100">
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

          <h2 className="pb-2 pt-6 text-[13px] font-medium text-neutral-400">Who is in</h2>
          <div className="flex flex-wrap gap-2">
            {split.people.map((person) => (
              <span
                key={person.id}
                className="flex items-center gap-1.5 rounded-full border border-neutral-200 py-1.5 pl-3 pr-1.5 text-[13px]"
              >
                {person.name}
                <button
                  onClick={() => setRemovingPerson(person.id)}
                  aria-label={`Remove ${person.name}`}
                  className="rounded-full p-0.5 text-neutral-300 hover:bg-neutral-100 hover:text-neutral-500"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            <span className="flex items-center gap-1 rounded-full border border-dashed border-neutral-300 py-1 pl-3 pr-1">
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
                className="w-24 bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
              />
              <button
                onClick={addPerson}
                aria-label="Add this person"
                className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>

          <h2 className="pb-1 pt-6 text-[13px] font-medium text-neutral-400">Items</h2>
          <div className="divide-y divide-neutral-100 border-y border-neutral-100">
            {split.entries.map((entry) => {
              const payer = split.people.find((person) => person.id === entry.paidBy)
              const sharers = entry.custom
                ? Object.keys(entry.custom).length
                : entry.shares.length || split.people.length
              const gap = customMismatch(entry)
              return (
                <button
                  key={entry.id}
                  onClick={() => setEntrySheet({ entry })}
                  className="flex w-full items-center gap-3 py-3 text-left active:bg-neutral-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{entry.label}</span>
                    <span className="block truncate text-[12px] text-neutral-400">
                      {payer ? `${payer.name} paid` : 'Nobody paid'} · {sharers}{' '}
                      {sharers === 1 ? 'share' : 'ways'}
                      {gap !== null && (
                        <span className="text-amber-600">
                          {' '}
                          · {plain(Math.abs(gap), split.currency)} unaccounted
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums">
                    {plain(entry.amount, split.currency)}
                  </span>
                </button>
              )
            })}

            <button
              onClick={() => setEntrySheet({ entry: null })}
              disabled={split.people.length === 0}
              className="w-full py-3 text-left text-[15px] text-neutral-400 disabled:opacity-40 active:bg-neutral-50"
            >
              + Add an item
            </button>
          </div>
        </div>

        <div>
          {split.entries.length > 0 && (
            <>
              <div className="flex items-baseline justify-between pt-4 lg:pt-0">
                <span className="text-[15px] font-medium">Total</span>
                <span className="text-[19px] font-semibold tabular-nums">
                  {money(total, split.currency)}
                </span>
              </div>

              <h2 className="pb-1 pt-6 text-[13px] font-medium text-neutral-400">Where it stands</h2>
              <div className="divide-y divide-neutral-100 border-y border-neutral-100">
                {rows.map((row) => (
                  <div key={row.person.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[14px]">{row.person.name}</span>
                    <span className="shrink-0 text-[12px] text-neutral-400 tabular-nums">
                      paid {plain(row.paid, split.currency)} · owed{' '}
                      {plain(row.owed, split.currency)}
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

              <h2 className="pb-1 pt-6 text-[13px] font-medium text-neutral-400">Settle up</h2>
              {transfers.length === 0 ? (
                <p className="border-y border-neutral-100 py-4 text-[14px] text-neutral-500">
                  Everyone is square. Nothing to pay.
                </p>
              ) : (
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
              )}
              <p className="pt-2 text-[12px] leading-5 text-neutral-400">
                {transfers.length === 0
                  ? ''
                  : `${transfers.length} ${
                      transfers.length === 1 ? 'payment' : 'payments'
                    } clears the whole thing.`}
              </p>

              <ShareCard split={split} onChange={change} onToast={onToast} />
            </>
          )}

          <div className="pt-8">
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full rounded-full border border-neutral-200 py-3 text-[15px] font-medium text-red-600"
            >
              Delete this split
            </button>
          </div>
        </div>
      </main>

      {removingPerson && (
        <Confirm
          title={`Remove ${removingName}?`}
          detail={
            owedBy(removingPerson) === 0
              ? 'They have not paid for anything, so nothing else changes.'
              : `The ${owedBy(removingPerson)} ${
                  owedBy(removingPerson) === 1
                    ? 'item they paid for goes'
                    : 'items they paid for go'
                } with them.`
          }
          confirmLabel="Remove"
          tone="danger"
          onConfirm={() => removePerson(removingPerson)}
          onCancel={() => setRemovingPerson(null)}
        />
      )}

      {confirmDelete && (
        <Confirm
          title={`Delete ${split.title.trim() || 'this split'}?`}
          detail={
            split.expense_id === null
              ? 'The people and items go with it. This cannot be undone.'
              : 'The people and items go with it. Any expense it added to your spending stays.'
          }
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => {
            deleteSplit(split.id)
            onToast('Split deleted')
            onClose()
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {entrySheet && (
        <EntrySheet
          split={split}
          entry={entrySheet.entry}
          onClose={() => setEntrySheet(null)}
          onSave={(entry) => {
            const exists = split.entries.some((row) => row.id === entry.id)
            change({
              ...split,
              entries: exists
                ? split.entries.map((row) => (row.id === entry.id ? entry : row))
                : [...split.entries, entry],
            })
            setEntrySheet(null)
          }}
          onDelete={
            entrySheet.entry
              ? () => {
                  change({
                    ...split,
                    entries: split.entries.filter((row) => row.id !== entrySheet.entry?.id),
                  })
                  setEntrySheet(null)
                }
              : undefined
          }
        />
      )}
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
          hint="Tap + to add who is in, then each thing somebody paid for"
        />
      ) : (
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          {ordered.map((split) => {
            const inSpending = expenses.some((expense) => expense.id === split.expense_id)
            return (
              <button
                key={split.id}
                onClick={() => onOpen(split.id)}
                className="flex w-full items-center gap-3 py-3.5 text-left active:bg-neutral-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">
                    {split.title || 'Untitled split'}
                  </span>
                  <span className="block truncate text-[12px] text-neutral-400">
                    {shortDate(split.date)} · {split.people.length} people ·{' '}
                    {split.entries.length} {split.entries.length === 1 ? 'item' : 'items'}
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
