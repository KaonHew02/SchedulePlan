import { useEffect, useRef, useState, type ComponentType } from 'react'
import Confirm from './Confirm'
import LanguageSelect from './LanguageSelect'
import {
  CloudDownIcon,
  CloudIcon,
  CloudUpIcon,
  DownloadIcon,
  RefreshIcon,
  Spinner,
  UploadIcon,
} from './Icons'
import { todayISO } from '../lib/date'
import { useDriveAutosave, type AutoState } from '../lib/autosave'
import { applyDrive, peekDrive, preloadDrive, saveToDrive } from '../lib/drive'
import { tr } from '../lib/i18n'
import { driveIsConfigured } from '../lib/drive-config'
import {
  countIn,
  fullSnapshot,
  itemCount,
  mergeIn,
  updateSettings,
  useSaveState,
  useSettings,
  type Snapshot,
} from '../lib/store'

/**
 * One strip for everything to do with copies of your notebook.
 *
 * It replaced a list of four rows reading "Export a copy — downloads one JSON
 * file", which was accurate and completely forgettable. The bar puts the thing
 * that actually matters first — *when did this last get saved, and is there a
 * copy anywhere else* — and makes the four actions one tap rather than a row
 * to read and then choose.
 *
 * Two shapes, because it lives in two places. On a phone it is a dark card
 * inside More, where it has a column's width and needs to hold together as a
 * block. On a laptop it is a light row pinned across the top of every screen,
 * where a black slab would shout over the content underneath it.
 *
 * The language switch rides along beside Auto. It is not about backups, but
 * this is the one strip that is on every screen of a laptop and at the top of
 * More on a phone — the two places someone looks for a setting like that.
 */

/** A pending replace, held until the user has seen what it would do. */
interface Pending {
  source: string
  data: Snapshot
}

function timeOf(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function autoNote(state: AutoState): string | null {
  switch (state.kind) {
    case 'waiting':
      return tr('Drive copy queued', '等待存到 Drive')
    case 'saving':
      return tr('Copying to Drive…', '正在存到 Drive…')
    case 'needs-tap':
      return tr(
        'Press To Drive once to sign in again — auto cannot open the Google window by itself.',
        '请按一次「存到 Drive」重新登录 — 自动保存没办法自己打开 Google 登录窗口。',
      )
    case 'error':
      return state.message
    default:
      return null
  }
}

interface ActionSpec {
  key: string
  icon: ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  disabled?: boolean
}

export default function BackupBar({
  onToast,
  onOpenData,
  variant = 'card',
}: {
  onToast: (message: string) => void
  onOpenData: () => void
  /** 'card' is the dark block in More; 'bar' is the light desktop top row. */
  variant?: 'card' | 'bar'
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const settings = useSettings()
  const save = useSaveState()
  const auto = useDriveAutosave()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const configured = driveIsConfigured()
  const dark = variant === 'card'

  useEffect(preloadDrive, [])

  function run(label: string, work: () => Promise<void>) {
    setError(null)
    setBusy(label)
    work()
      .catch((err) => setError(err instanceof Error ? err.message : tr('Something went wrong.', '出了点问题。')))
      .finally(() => setBusy(null))
  }

  async function exportFile() {
    const data = await fullSnapshot()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `scheduleplan-${todayISO()}.json`
    link.click()
    // Revoking straight away can beat the download starting in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    onToast(tr(`Exported ${countIn(data)} items`, `已导出 ${countIn(data)} 项`))
  }

  async function readChosenFile(file: File) {
    let data: Snapshot
    try {
      data = JSON.parse(await file.text()) as Snapshot
    } catch {
      throw new Error(tr("That file isn't readable JSON.", '这个文件不是可读的 JSON。'))
    }
    if (!Array.isArray(data?.schedule)) {
      throw new Error(tr("That file isn't a SchedulePlan backup.", '这个文件不是 SchedulePlan 的备份。'))
    }
    setPending({ source: file.name, data })
  }

  /*
   * Two different jobs behind one button, and they are not the same job.
   *
   * **From Drive** is a restore: the copy in Drive is the notebook, and
   * pulling it down means this device should look like that copy. Replace.
   *
   * **Import** is not. A file you are handed can be a whole notebook or five
   * rows of somebody's itinerary, and replacing on the strength of that meant
   * the only way to accept the five was to lose the rest. It adds now, and
   * skips rows it already has — so importing your own backup over your own
   * notebook finds everything present and changes nothing, which is what that
   * gesture should have meant all along.
   */
  function confirmApply() {
    if (!pending) return
    const fromDrive = pending.source === 'Drive'
    run('restore', async () => {
      if (fromDrive) {
        const count = await applyDrive(pending.data)
        setPending(null)
        onToast(tr(`Restored ${count} items`, `已恢复 ${count} 项`))
        return
      }
      const { added, skipped } = await mergeIn(pending.data)
      setPending(null)
      onToast(
        added === 0
          ? tr('Everything in that file was already here', '文件里的内容这里都已经有了')
          : tr(
              `Added ${added} items${skipped ? `, skipped ${skipped} already here` : ''}`,
              `已添加 ${added} 项${skipped ? `，跳过已有的 ${skipped} 项` : ''}`,
            ),
      )
    })
  }

  const actions: ActionSpec[] = [
    {
      key: 'save',
      icon: CloudUpIcon,
      label: tr('To Drive', '存到 Drive'),
      disabled: !configured,
      onClick: () =>
        run('save', async () => {
          const count = await saveToDrive()
          onToast(tr(`Saved ${count} items to Drive`, `已把 ${count} 项存到 Drive`))
        }),
    },
    {
      key: 'load',
      icon: CloudDownIcon,
      label: tr('From Drive', '从 Drive 取回'),
      disabled: !configured,
      onClick: () =>
        run('load', async () => {
          setPending({ source: 'Drive', data: await peekDrive() })
        }),
    },
    { key: 'export', icon: DownloadIcon, label: tr('Export', '导出'), onClick: () => run('export', exportFile) },
    { key: 'import', icon: UploadIcon, label: tr('Import', '导入'), onClick: () => fileInput.current?.click() },
  ]

  const note = autoNote(auto)

  const savedLabel = save.saving ? (
    <>
      <Spinner className="h-3.5 w-3.5" />
      {tr('Saving', '正在保存')}
    </>
  ) : save.error ? (
    <span className={dark ? 'text-red-400' : 'text-red-600'}>{tr('Not saved — tap to see why', '没有保存 — 点这里看原因')}</span>
  ) : save.savedAt ? (
    <>
      {tr('Saved', '已保存')} {timeOf(save.savedAt)}
      <CloudIcon className={`h-3.5 w-3.5 ${dark ? 'text-neutral-500' : 'text-brand-400'}`} />
    </>
  ) : (
    tr('Your data', '你的资料')
  )

  const autoButton = (
    <button
      onClick={() => updateSettings({ autoDrive: !settings.autoDrive })}
      disabled={!configured}
      aria-pressed={settings.autoDrive}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-35 ${
        settings.autoDrive
          ? 'bg-brand-500 text-white'
          : dark
            ? 'text-neutral-300 hover:bg-white/10'
            : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
      } ${dark ? '' : 'rounded-full'}`}
    >
      <RefreshIcon className="h-3.5 w-3.5" />
      {tr('Auto', '自动')}
    </button>
  )

  const notices = (
    <>
      {!configured && (
        <p className="px-1 pt-2 text-[12px] leading-5 text-neutral-400">
          {tr(
            'Drive is not set up in this build, so Export and Import are the second copy. See docs/DRIVE.md.',
            '这个版本没有设置 Drive，所以第二份副本要靠导出和导入。见 docs/DRIVE.md。',
          )}
        </p>
      )}

      {note && (
        <p
          className={`px-1 pt-2 text-[12px] leading-5 ${
            auto.kind === 'error' || auto.kind === 'needs-tap'
              ? 'text-amber-700'
              : 'text-neutral-400'
          }`}
        >
          {note}
        </p>
      )}

      {save.error && (
        <p className="mt-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-700">
          {tr('This browser would not save that change:', '这个浏览器没能保存刚才的改动：')} {save.error}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-700">
          {error}
        </p>
      )}

      {/*
        A dialog, not a card in the flow. Inline, this question appeared
        between the backup bar and the screen's own header and pushed the
        whole notebook down the page — it read as a glitch rather than as a
        question worth stopping for.
      */}
      {pending && (
        <Confirm
          title={
            pending.source === 'Drive'
              ? tr(
                  `Replace the ${itemCount()} items on this device with ${countIn(pending.data)} from Drive?`,
                  `用 Drive 上的 ${countIn(pending.data)} 项替换这台设备上的 ${itemCount()} 项？`,
                )
              : tr(
                  `Add ${countIn(pending.data)} items from ${pending.source} to the ${itemCount()} already here?`,
                  `把「${pending.source}」里的 ${countIn(pending.data)} 项加到这里已有的 ${itemCount()} 项中？`,
                )
          }
          detail={
            pending.source === 'Drive'
              ? tr('This cannot be undone. Export first if you are unsure.', '这一步不能撤销。不确定的话，先导出一份。')
              : tr(
                  'Nothing here is removed. Anything the file already matches is skipped rather than added twice.',
                  '这里的东西不会被删除。文件里和这里重复的会跳过，不会加两次。',
                )
          }
          confirmLabel={
            busy === 'restore'
              ? pending.source === 'Drive'
                ? tr('Restoring...', '正在恢复…')
                : tr('Adding...', '正在添加…')
              : pending.source === 'Drive'
                ? tr('Replace', '替换')
                : tr('Add', '添加')
          }
          busy={busy === 'restore'}
          onConfirm={confirmApply}
          onCancel={() => setPending(null)}
        />
      )}

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = '' // so choosing the same file twice still fires
          if (file) run('import', () => readChosenFile(file))
        }}
      />
    </>
  )

  if (!dark) {
    return (
      <>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={onOpenData}
            className="mr-auto flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-0.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {savedLabel}
          </button>

          <LanguageSelect />
          {autoButton}

          {actions.map(({ key, icon: Icon, label, onClick, disabled }) => (
            <button
              key={key}
              onClick={onClick}
              disabled={disabled || busy !== null}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-35"
            >
              {busy === key ? <Spinner className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              {label}
            </button>
          ))}
        </div>
        {notices}
      </>
    )
  }

  return (
    <>
      <div className="rounded-2xl bg-neutral-900 p-2">
        <div className="flex items-center gap-2 px-1.5 pb-1.5 pt-1">
          <button
            onClick={onOpenData}
            className="flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-0.5 text-[13px] text-neutral-400 transition-colors hover:text-neutral-200"
          >
            {savedLabel}
          </button>
          <span className="ml-auto flex items-center gap-1">
            <LanguageSelect dark />
            {autoButton}
          </span>
        </div>

        {/*
          Two by two on a phone, four across from 380px up. Four in a row is
          361px of buttons, which on a 320px screen pushed the whole page into
          scrolling sideways — and a notebook that slides left when you touch
          it feels broken long before you work out why.
        */}
        <div className="grid grid-cols-2 gap-0.5 border-t border-white/10 pt-1.5 min-[380px]:grid-cols-4">
          {actions.map(({ key, icon: Icon, label, onClick, disabled }) => (
            <button
              key={key}
              onClick={onClick}
              disabled={disabled || busy !== null}
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-medium text-neutral-200 transition-colors hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-transparent"
            >
              {busy === key ? <Spinner className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>
      {notices}
    </>
  )
}
