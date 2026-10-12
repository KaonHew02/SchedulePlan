import { useState, type ComponentType } from 'react'
import BackupBar from '../components/BackupBar'
import CurrencySelect from '../components/CurrencySelect'
import DataSheet from '../components/DataSheet'
import HolidaySettings from '../components/HolidaySettings'
import { ChevronRight, ScanIcon, TagIcon, WalletIcon } from '../components/Icons'
import Logo from '../components/Logo'
import { MONEY } from '../lib/features'
import { tr } from '../lib/i18n'
import LabelsScreen from '../tools/LabelsScreen'
import ScanScreen from '../tools/ScanScreen'
import { updateSettings, useSettings } from '../lib/store'

/**
 * What is left behind More.
 *
 * Currency is in the nav, Translate followed it, and Bill split is a tab
 * inside Expenses — which is the point of this screen working: things graduate
 * out of it when they turn out to be used every day. Translate lasted here
 * about an hour.
 */
type Page = 'scan' | 'tags' | 'categories'

function Row({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 py-3.5 text-left active:bg-neutral-50"
    >
      <Icon className="h-[18px] w-[18px] shrink-0 text-neutral-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        <span className="block text-[13px] text-neutral-400">{hint}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
    </button>
  )
}

export default function MoreScreen({ onToast }: { onToast: (message: string) => void }) {
  const [page, setPage] = useState<Page | null>(null)
  const [showData, setShowData] = useState(false)
  const settings = useSettings()

  const back = () => setPage(null)

  if (page === 'scan') return <ScanScreen onBack={back} onToast={onToast} />
  if (page === 'tags') return <LabelsScreen kind="tags" onBack={back} onToast={onToast} />
  if (page === 'categories') {
    return <LabelsScreen kind="categories" onBack={back} onToast={onToast} />
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm">
        <div className="px-5 pb-3 pt-4 lg:px-8">
          <h1 className="text-[19px] font-semibold tracking-tight lg:text-[22px]">{tr('More', '更多')}</h1>
        </div>
      </header>

      <main className="px-5 pb-28 lg:px-8 lg:pb-10">
        {/* On a laptop the backup controls are already across the top of every
            screen, so repeating them here would be two of the same thing. */}
        <div className="lg:hidden">
          <BackupBar onToast={onToast} onOpenData={() => setShowData(true)} />
        </div>

        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10">
        <div>
        <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400 lg:pt-2">{tr('Tools', '工具')}</h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          <Row
            icon={ScanIcon}
            label={tr('Document scanner', '文档扫描')}
            hint={tr('Read a booking or a page into the schedule', '把订单或纸上的内容读进日程')}
            onClick={() => setPage('scan')}
          />
        </div>

        <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400">{tr('Calendar', '日历')}</h2>
        <HolidaySettings />

        <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400">{tr('Labels', '标签')}</h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          <Row
            icon={TagIcon}
            label={tr('Schedule tags', '日程标签')}
            hint={tr('The chips on the add form', '添加表单上的那排标签')}
            onClick={() => setPage('tags')}
          />
          {MONEY && (
            <Row
              icon={WalletIcon}
              label={tr('Expense categories', '开销分类')}
              hint={tr('How spending is grouped', '开销怎么分组')}
              onClick={() => setPage('categories')}
            />
          )}
        </div>

        </div>

        <div>
        <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400 lg:pt-2">{tr('Money', '货币')}</h2>
        <div className="border-y border-neutral-100">
          <div className="flex items-center justify-between gap-3 py-3.5">
            <span className="min-w-0">
              <span className="block text-[15px]">{tr('Shown in', '显示为')}</span>
              <span className="block text-[13px] text-neutral-400">
                {tr('What totals are added up in', '合计用哪种货币来算')}
              </span>
            </span>
            <CurrencySelect
              value={settings.currency}
              onChange={(code) => updateSettings({ currency: code })}
              label={tr('Home currency', '本币')}
            />
          </div>
        </div>
        <p className="pt-1.5 text-[12px] leading-5 text-neutral-400">
          {tr(
            'The same setting as the one at the bottom of Currency, where the rates are.',
            '和「汇率」页底部的设置是同一个。',
          )}
        </p>

        </div>
        </div>

        <p className="pt-8 text-[13px] leading-5 text-neutral-500">
          {tr(
            'Your notebook is kept in this browser only. Tap the saved time in the bar to see exactly where it lives, and how much room it is using.',
            '你的记事本只保存在这个浏览器里。点上方栏里的保存时间，可以看到它具体存在哪里、占用了多少空间。',
          )}
        </p>

        <div className="flex flex-col items-center gap-2 pb-8 pt-10">
          <Logo size={44} />
          <p className="text-[14px] font-medium tracking-tight">SchedulePlan</p>
          <p className="text-[13px] text-neutral-300">{tr('Version 0.2', '版本 0.2')}</p>
        </div>
      </main>

      {showData && <DataSheet onClose={() => setShowData(false)} onToast={onToast} />}
    </>
  )
}
