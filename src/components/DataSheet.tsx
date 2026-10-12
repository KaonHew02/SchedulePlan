import { useEffect, useState } from 'react'
import { CloudIcon, DatabaseIcon, GoogleG, OfflineIcon, Spinner } from './Icons'
import Sheet from './Sheet'
import { storageUse, type StorageUse } from '../lib/idb'
import { prettySize, sweepFiles } from '../lib/files'
import { driveIsConfigured } from '../lib/drive-config'
import { locale, tr } from '../lib/i18n'
import { useOfflineState, type OfflineState } from '../lib/offline'
import { itemCount, snapshot, useSettings } from '../lib/store'

/** Whether the app itself, and not only the notebook, will open with no signal. */
function offlineLine(state: OfflineState): string {
  if (state === 'ready') {
    return tr(
      'The app is saved in this browser too, so it opens with no wifi and no data — ' +
        'schedule, photos and attachments included. Only fetching something new waits for a ' +
        'signal: Drive, fresh rates, translating, reading text off a photo.',
      '应用本身也存在这个浏览器里，所以没有 wifi、没有流量也能打开——日程、照片和附件都在。' +
        '只有获取新东西时才要等网络：Drive、最新汇率、翻译、从照片里读文字。',
    )
  }
  if (state === 'preparing') {
    return tr(
      'Saving a copy of the app so it can open with no signal. Leave it open on a connection ' +
        'for a minute; this line changes when it is done.',
      '正在保存一份应用副本，以后没有网络也能打开。请保持联网，让它开着一分钟左右；完成后这行字会变。',
    )
  }
  if (import.meta.env.DEV) {
    return tr(
      'The development server never keeps an offline copy. The published site does.',
      '开发服务器从不保存离线副本，发布的网站才会。',
    )
  }
  return tr(
    'This browser will not keep a copy of the app, so opening it needs a signal. Once it is ' +
      'open, everything already in it works offline.',
    '这个浏览器不肯保存应用副本，所以打开时需要网络。打开之后，里面已有的内容都能离线使用。',
  )
}

/** 'just now', '2 days ago' — how long since, in the roundest useful unit. */
function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 90) return tr('just now', '刚刚')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return tr(`${minutes} minutes ago`, `${minutes} 分钟前`)
  const hours = Math.round(minutes / 60)
  if (hours < 24) return tr(`${hours} ${hours === 1 ? 'hour' : 'hours'} ago`, `${hours} 小时前`)
  const days = Math.round(hours / 24)
  if (days < 30) return tr(`${days} ${days === 1 ? 'day' : 'days'} ago`, `${days} 天前`)
  const months = Math.round(days / 30)
  return tr(`${months} ${months === 1 ? 'month' : 'months'} ago`, `${months} 个月前`)
}

/** How full it is, in words, because a percentage under 1% tells you nothing. */
function fullness(used: number, quota: number): string {
  if (!quota) return tr('the browser will not say how much room there is', '浏览器没说总共有多少空间')
  const share = used / quota
  if (share < 0.01) return tr('barely a dent', '几乎没占用')
  if (share < 0.1) return tr('plenty of room left', '还有很多空间')
  if (share < 0.5) return tr('comfortable', '很宽裕')
  if (share < 0.85) return tr('over half full', '已用了一半以上')
  return tr('nearly full — time to clear some attachments', '快满了——该清掉一些附件了')
}

/**
 * Where the data is, and what the second copy is.
 *
 * This screen exists because "it's in your browser" is not something anyone
 * should have to take on faith. It says which store, whether the browser has
 * agreed to keep it, how much room it is taking, and when Drive last saw a
 * copy — and it is the one place that spells out that nothing leaves this
 * device unless a button is pressed.
 */
export default function DataSheet({
  onClose,
  onToast,
}: {
  onClose: () => void
  onToast: (message: string) => void
}) {
  const settings = useSettings()
  const offline = useOfflineState()
  const [use, setUse] = useState<StorageUse | null>(null)
  const [sweeping, setSweeping] = useState(false)

  useEffect(() => {
    void storageUse().then(setUse)
  }, [])

  const data = snapshot()
  const attachments = [
    ...data.schedule.flatMap((item) => item.attachments),
    ...data.expenses.flatMap((expense) => expense.attachments),
  ]
  const attachmentBytes = attachments.reduce((total, file) => total + file.size, 0)
  const share = use?.quota ? Math.min(1, use.used / use.quota) : 0

  async function sweep() {
    setSweeping(true)
    try {
      const removed = await sweepFiles(attachments.map((file) => file.id))
      setUse(await storageUse())
      onToast(
        removed === 0
          ? tr('Nothing left over to clear', '没有需要清理的残留文件')
          : tr(`Cleared ${removed} stray files`, `已清理 ${removed} 个残留文件`),
      )
    } catch {
      onToast(tr("Couldn't tidy up just now", '暂时清理不了'))
    } finally {
      setSweeping(false)
    }
  }

  return (
    <Sheet onClose={onClose} title={tr('Your data', '你的数据')}>
      <section>
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <DatabaseIcon className="h-[18px] w-[18px] text-neutral-400" />
          {tr('Where it lives', '存在哪里')}
        </h3>
        <p className="mt-1.5 text-[14px] leading-6 text-neutral-600">
          {tr('In this browser, in IndexedDB. ', '在这个浏览器的 IndexedDB 里。')}
          {use?.persisted
            ? tr(
                'Marked to be kept — the browser will not clear it to free space.',
                '已标记为保留——浏览器不会为了腾空间而清掉它。',
              )
            : tr(
                'The browser has not promised to keep it, so clearing site data would take it.',
                '浏览器没有承诺保留它，所以清除网站数据会把它一起清掉。',
              )}
        </p>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${Math.max(0.6, share * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-[13px] text-neutral-500">
          {use ? (
            tr(
              <>
                {prettySize(use.used)} of {use.quota ? prettySize(use.quota) : 'an unknown amount'} —{' '}
                {fullness(use.used, use.quota)}
              </>,
              <>
                已用 {prettySize(use.used)}，{use.quota ? `共 ${prettySize(use.quota)}` : '总量未知'}——
                {fullness(use.used, use.quota)}
              </>,
            )
          ) : (
            <span className="flex items-center gap-1.5 text-neutral-400">
              <Spinner className="h-3 w-3" /> {tr('Measuring', '正在计算')}
            </span>
          )}
        </p>
        <p className="mt-1 text-[13px] text-neutral-400">
          {tr(
            <>
              {itemCount()} records and {attachments.length}{' '}
              {attachments.length === 1 ? 'attachment' : 'attachments'}
              {attachments.length > 0 && ` (${prettySize(attachmentBytes)})`}
            </>,
            <>
              {itemCount()} 条记录，{attachments.length} 个附件
              {attachments.length > 0 && `（${prettySize(attachmentBytes)}）`}
            </>,
          )}
        </p>
      </section>

      <section className="mt-6">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          {driveIsConfigured() ? (
            <GoogleG className="h-[18px] w-[18px]" />
          ) : (
            <CloudIcon className="h-[18px] w-[18px] text-neutral-400" />
          )}
          {tr('The second copy', '第二份副本')}
        </h3>
        <p className="mt-1.5 text-[14px] leading-6 text-neutral-600">
          {settings.lastDriveSync ? (
            tr(
              <>
                In Drive, {ago(settings.lastDriveSync)} —{' '}
                {new Date(settings.lastDriveSync).toLocaleString(locale())}.
              </>,
              <>
                {ago(settings.lastDriveSync)}存到了 Drive——
                {new Date(settings.lastDriveSync).toLocaleString(locale())}。
              </>,
            )
          ) : driveIsConfigured() ? (
            tr('Nothing has gone to Drive from this browser yet.', '这个浏览器还没往 Drive 存过东西。')
          ) : (
            tr(
              'Drive is not set up, so Export is the only second copy there is.',
              'Drive 还没设置好，所以导出的文件是唯一的第二份副本。',
            )
          )}
        </p>
        <p className="mt-2 text-[14px] leading-6 text-neutral-600">
          {tr(
            <>
              Drive holds a <span className="font-medium">copy</span>, and so does an exported file —
              the same file either way. Nothing leaves this browser unless you press one of the
              buttons in the bar, and SchedulePlan works with no account at all.
            </>,
            <>
              Drive 里存的是一份<span className="font-medium">副本</span>，导出的文件也是——两者是同一个文件。除非你按了上方栏里的按钮，否则什么都不会离开这个浏览器；SchedulePlan 不用任何账号也能用。
            </>,
          )}
        </p>
      </section>

      <section className="mt-6">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <OfflineIcon className="h-[18px] w-[18px] text-neutral-400" />
          {tr('With no signal', '没有网络时')}
        </h3>
        <p className="mt-1.5 text-[14px] leading-6 text-neutral-600">{offlineLine(offline)}</p>
      </section>

      <section className="mt-6 border-t border-neutral-100 pt-4">
        <button
          onClick={sweep}
          disabled={sweeping}
          className="flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-[14px] font-medium disabled:opacity-40"
        >
          {sweeping && <Spinner className="h-4 w-4" />}
          {tr('Tidy up leftovers', '清理残留文件')}
        </button>
        <p className="mt-1.5 text-[12px] leading-5 text-neutral-400">
          {tr(
            'Drops attachment files that no record points at any more. Nothing you can see is touched.',
            '删掉已经没有任何记录在用的附件文件。你能看到的内容都不会动。',
          )}
        </p>
      </section>

      <div className="mt-6 flex justify-end pb-2">
        <button
          onClick={onClose}
          className="rounded-full border border-neutral-200 px-6 py-2.5 text-[14px] font-medium"
        >
          {tr('Close', '关闭')}
        </button>
      </div>
    </Sheet>
  )
}
