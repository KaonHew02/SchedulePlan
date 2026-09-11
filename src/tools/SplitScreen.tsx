import { useMemo, useState } from 'react'
import CurrencySelect from '../components/CurrencySelect'
import { DateField, Field, Segmented } from '../components/FormFields'
import { ChevronLeft, ChevronRight, Plus, TrashIcon, UsersIcon } from '../components/Icons'
import Sheet from '../components/Sheet'
import { shortDate, todayISO } from '../lib/date'
import { money, plain } from '../lib/currency'
import {
  customMismatch,
  newEntryId,
  newPersonId,
  positions,
  settle,
  splitTotal,
} from '../lib/split'
import { deleteSplit, newSplitId, saveSplit, useSettings, useSplits } from '../lib/store'
import type { BillSplit, SplitEntry } from '../types'

/**
 * Splitting a bill between people who all paid for bits of it.
 *
 * The screen is built around the question that actually gets asked at the end
 * of a trip — *who owes whom* — rather than the one a spreadsheet answers,
 * which is what everything cost. See lib/split.ts for the arithmetic and for
 * why the settlement is greedy.
 */

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

function Editor({
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

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-1 px-3 pb-3 pt-4">
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

      <main className="px-5 pb-28">
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

        {removingPerson && (
          <div className="mt-3 rounded-xl border border-neutral-200 p-4">
            <p className="text-[14px] leading-6">
              Remove {split.people.find((person) => person.id === removingPerson)?.name}?
            </p>
            <p className="mt-1 text-[13px] leading-5 text-neutral-400">
              {owedBy(removingPerson) === 0
                ? 'They have not paid for anything, so nothing else changes.'
                : `The ${owedBy(removingPerson)} ${
                    owedBy(removingPerson) === 1 ? 'item they paid for goes' : 'items they paid for go'
                  } with them.`}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRemovingPerson(null)}
                className="flex-1 rounded-full border border-neutral-200 py-2.5 text-[14px] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => removePerson(removingPerson)}
                className="flex-1 rounded-full bg-red-600 py-2.5 text-[14px] font-medium text-white"
              >
                Remove
              </button>
            </div>
          </div>
        )}

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

        {split.entries.length > 0 && (
          <>
            <div className="flex items-baseline justify-between pt-4">
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
          </>
        )}

        <div className="pt-8">
          {confirmDelete ? (
            <button
              onClick={() => {
                deleteSplit(split.id)
                onToast('Split deleted')
                onClose()
              }}
              className="w-full rounded-full bg-red-600 py-3 text-[15px] font-medium text-white"
            >
              Tap to confirm
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full rounded-full border border-neutral-200 py-3 text-[15px] font-medium text-red-600"
            >
              Delete this split
            </button>
          )}
        </div>
      </main>

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

export default function SplitScreen({
  onBack,
  onToast,
}: {
  onBack: () => void
  onToast: (message: string) => void
}) {
  const splits = useSplits()
  const settings = useSettings()
  const [openId, setOpenId] = useState<number | null>(null)
  const open = splits.find((split) => split.id === openId)

  function create() {
    const split: BillSplit = {
      id: newSplitId(),
      title: '',
      date: todayISO(),
      currency: settings.currency,
      people: [{ id: 'p1', name: 'Me' }],
      entries: [],
    }
    saveSplit(split)
    setOpenId(split.id)
  }

  if (open) {
    return <Editor initial={open} onClose={() => setOpenId(null)} onToast={onToast} />
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-1 px-3 pb-3 pt-4">
          <button onClick={onBack} aria-label="Back to More" className="p-1.5 text-neutral-400">
            <ChevronLeft />
          </button>
          <h1 className="text-[19px] font-semibold tracking-tight">Bill split</h1>
        </div>
      </header>

      <main className="px-5 pb-28">
        {splits.length === 0 ? (
          <div className="py-14 text-center">
            <UsersIcon className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-[15px] text-neutral-500">Nothing being split yet</p>
            <p className="mx-auto mt-1 max-w-[260px] text-[13px] leading-5 text-neutral-400">
              Add who is in, then each thing somebody paid for. The settling-up is worked out for
              you.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 border-y border-neutral-100">
            {splits
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
              .map((split) => (
                <button
                  key={split.id}
                  onClick={() => setOpenId(split.id)}
                  className="flex w-full items-center gap-3 py-3.5 text-left active:bg-neutral-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">
                      {split.title || 'Untitled split'}
                    </span>
                    <span className="block text-[12px] text-neutral-400">
                      {shortDate(split.date)} · {split.people.length} people ·{' '}
                      {split.entries.length} {split.entries.length === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums">
                    {plain(splitTotal(split), split.currency)}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
                </button>
              ))}
          </div>
        )}

        <button
          onClick={create}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-3 text-[15px] font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          New split
        </button>
      </main>
    </>
  )
}
