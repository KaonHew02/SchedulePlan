import { useState, type ComponentType } from 'react'
import BackupBar from '../components/BackupBar'
import CurrencySelect from '../components/CurrencySelect'
import DataSheet from '../components/DataSheet'
import { ChevronRight, ScanIcon, TagIcon, WalletIcon } from '../components/Icons'
import Logo from '../components/Logo'
import LabelsScreen from '../tools/LabelsScreen'
import ScanScreen from '../tools/ScanScreen'
import { updateSettings, useSettings } from '../lib/store'

/**
 * What is left behind More.
 *
 * Currency is in the nav now and Bill split is a tab inside Expenses, which
 * is the point of this screen working: things graduate out of it when they
 * turn out to be used every day.
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
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="px-5 pb-3 pt-4 lg:px-8">
          <h1 className="text-[19px] font-semibold tracking-tight lg:text-[22px]">More</h1>
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
        <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400 lg:pt-2">Tools</h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          <Row
            icon={ScanIcon}
            label="Document scanner"
            hint="Read a booking or a page into the schedule"
            onClick={() => setPage('scan')}
          />
        </div>

        <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400">Labels</h2>
        <div className="divide-y divide-neutral-100 border-y border-neutral-100">
          <Row
            icon={TagIcon}
            label="Schedule tags"
            hint="The chips on the add form"
            onClick={() => setPage('tags')}
          />
          <Row
            icon={WalletIcon}
            label="Expense categories"
            hint="How spending is grouped"
            onClick={() => setPage('categories')}
          />
        </div>

        </div>

        <div>
        <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400 lg:pt-2">Money</h2>
        <div className="border-y border-neutral-100">
          <div className="flex items-center justify-between gap-3 py-3.5">
            <span className="min-w-0">
              <span className="block text-[15px]">Shown in</span>
              <span className="block text-[13px] text-neutral-400">
                What totals are added up in
              </span>
            </span>
            <CurrencySelect
              value={settings.currency}
              onChange={(code) => updateSettings({ currency: code })}
              label="Home currency"
            />
          </div>
        </div>
        <p className="pt-1.5 text-[12px] leading-5 text-neutral-400">
          The same setting as the one at the bottom of Currency, where the rates are.
        </p>

        </div>
        </div>

        <p className="pt-8 text-[13px] leading-5 text-neutral-500">
          Your notebook is kept in this browser only. Tap the saved time in the bar to see
          exactly where it lives, and how much room it is using.
        </p>

        <div className="flex flex-col items-center gap-2 pb-8 pt-10">
          <Logo size={44} />
          <p className="text-[14px] font-medium tracking-tight">SchedulePlan</p>
          <p className="text-[13px] text-neutral-300">Version 0.2</p>
        </div>
      </main>

      {showData && <DataSheet onClose={() => setShowData(false)} onToast={onToast} />}
    </>
  )
}
