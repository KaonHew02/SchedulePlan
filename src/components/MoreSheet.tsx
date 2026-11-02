import { promptInstall, useInstallWay } from '../lib/install'
import { tr } from '../lib/i18n'
import type { Screen } from '../types'
import { InstallIcon, ShareIcon } from './Icons'
import { SHEET, navItem, navLabel } from './navItems'
import Sheet from './Sheet'

/**
 * Each tile's icon on its own colour, so four tiles are told apart at a glance
 * rather than read. The 100 shades, not the 50s: on an iPhone the 50s were so
 * close to the tile that Seasons' square all but vanished, and the tile it sat
 * in read as an empty box.
 */
const TINT: Partial<Record<Screen, string>> = {
  seasons: 'bg-amber-100 text-amber-600',
  currency: 'bg-emerald-100 text-emerald-600',
  translate: 'bg-sky-100 text-sky-600',
  expenses: 'bg-rose-100 text-rose-600',
  more: 'bg-brand-100 text-brand-600',
}

/**
 * What the phone's More tab opens: the screens without a tab, two by two,
 * with the icon beside the name so each sits on one line, and — until the app
 * is on the home screen — how to put it there.
 */
export default function MoreSheet({
  current,
  onPick,
  onClose,
}: {
  current: Screen
  onPick: (screen: Screen) => void
  onClose: () => void
}) {
  return (
    <Sheet title={tr('More', '更多')} onClose={onClose} large>
      {/* The screen you are on is ringed in the accent, inside the tile's
          own edge, as MoneyFlow marks it — the tile keeps its colour. */}
      <div className="grid grid-cols-2 gap-2.5">
        {SHEET.map((id) => {
          const item = navItem(id)
          return (
            <button
              key={id}
              onClick={() => onPick(id)}
              aria-current={current === id ? 'page' : undefined}
              className={`flex min-w-0 items-center gap-3 rounded-[18px] bg-page p-3 text-left text-[14.5px] font-semibold transition-[scale] duration-150 ${
                current === id ? 'ring-2 ring-inset ring-brand-500' : ''
              }`}
            >
              <span
                className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[13px] ${TINT[id] ?? 'bg-neutral-100 text-neutral-600'}`}
              >
                <item.Icon className="h-[21px] w-[21px] stroke-[2.1]" />
              </span>
              <span className="min-w-0 truncate">{navLabel(item)}</span>
            </button>
          )
        })}
      </div>

      <InstallCard />

      <button
        onClick={onClose}
        className="mt-5 min-h-[52px] w-full rounded-2xl bg-brand-500 text-[16px] font-bold text-white"
      >
        {tr('Done', '完成')}
      </button>
    </Sheet>
  )
}

/**
 * Add to Home Screen, said the way this browser does it.
 *
 * On an iPhone the warning matters more than the steps: the home-screen app
 * can be given its own storage, apart from Safari's, so it may open empty the
 * first time. Said here, before anyone presses Add, that reads as an
 * instruction; found afterwards, it reads as a lost notebook.
 */
function InstallCard() {
  const way = useInstallWay()
  if (way === 'installed') return null

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[13px] bg-brand-500 text-white">
          <InstallIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold">{tr('Add to Home Screen', '添加到主屏幕')}</h3>
          <p className="text-[13px] leading-5 text-neutral-500">
            {tr(
              'Opens full screen like an app, and works with no signal.',
              '像 App 一样全屏打开，没有网络也能用。',
            )}
          </p>
        </div>
      </div>

      {way === 'prompt' && (
        <button
          onClick={() => void promptInstall()}
          className="mt-4 w-full rounded-full bg-brand-500 py-2.5 text-[14px] font-medium text-white"
        >
          {tr('Install', '安装')}
        </button>
      )}

      {way === 'ios' && (
        <>
          <ol className="mt-4 space-y-2 text-[13.5px] leading-5 text-neutral-700">
            <li className="flex gap-2.5">
              <Step n={1} />
              <span>
                {tr('In Safari, tap', '在 Safari 里点')}{' '}
                <ShareIcon className="mb-0.5 inline h-4 w-4 text-sky-600" />{' '}
                <b className="font-semibold">{tr('Share', '分享')}</b>
                {tr(' (on iOS 26 it is under ⋯).', '（iOS 26 在「⋯」里面）。')}
              </span>
            </li>
            <li className="flex gap-2.5">
              <Step n={2} />
              <span>
                {tr('Tap ', '点')}
                <b className="font-semibold">{tr('Add to Home Screen', '添加到主屏幕')}</b>
                {tr(' — scroll the list down if it is not in sight.', '，看不到就把列表往下滑。')}
              </span>
            </li>
            <li className="flex gap-2.5">
              <Step n={3} />
              <span>
                {tr('Leave ', '保持')}
                <b className="font-semibold">{tr('Open as Web App', '作为网页 App 打开')}</b>
                {tr(' on, then tap ', '开着，再点')}
                <b className="font-semibold">{tr('Add', '添加')}</b>
                {tr('.', '。')}
              </span>
            </li>
          </ol>
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[12.5px] leading-5 text-amber-900">
            {tr(
              'On iPhone the Home Screen app can keep its own notebook, apart from Safari’s. If it opens empty, nothing is lost — it is still here in Safari. Move it across with To Drive then From Drive, or Export then Import.',
              '在 iPhone 上，主屏幕的 App 可能有自己的一本记事本，和 Safari 的分开。如果打开是空的，东西没有丢，还在 Safari 里。先「存到 Drive」再「从 Drive 取回」，或先「导出」再「导入」，就能搬过去。',
            )}
          </p>
        </>
      )}

      {way === 'menu' && (
        <p className="mt-4 text-[13.5px] leading-5 text-neutral-700">
          {tr(
            'Open the browser’s menu (⋮) and choose Add to Home screen, or Install app.',
            '打开浏览器菜单（⋮），选「添加到主屏幕」或「安装应用」。',
          )}
        </p>
      )}
    </section>
  )
}

function Step({ n }: { n: number }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-600">
      {n}
    </span>
  )
}
