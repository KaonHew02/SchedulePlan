import { useState } from 'react'
import BackupBar from './components/BackupBar'
import BottomNav from './components/BottomNav'
import DataSheet from './components/DataSheet'
import SideNav from './components/SideNav'
import Toast from './components/Toast'
import ExpensesScreen from './expenses/ExpensesScreen'
import RemindersScreen from './reminders/RemindersScreen'
import MoreScreen from './screens/MoreScreen'
import ScheduleScreen from './screens/ScheduleScreen'
import TravelScreen from './travel/TravelScreen'
import type { Screen } from './types'

/**
 * How wide the content is allowed to get.
 *
 * Not uncapped, and not the old 896px column either. Uncapped puts a single
 * schedule card 1300px across with six words in it; 896px left a third of a
 * 1900px monitor as margin. 1500px centred fills about nine tenths of the
 * screen beside the sidebar and still keeps a line of text readable — and the
 * screens each grow a second column inside it rather than stretching one list.
 *
 * The header and the content share it, or the sticky headers would run edge to
 * edge while everything under them sat inset.
 */
const CONTENT = 'mx-auto w-full lg:max-w-[1500px]'

export default function App() {
  const [screen, setScreen] = useState<Screen>('schedule')
  const [toast, setToast] = useState<string | null>(null)
  const [showData, setShowData] = useState(false)

  return (
    <>
      {/*
        Three shapes, one tree. Phone: full bleed, bottom nav. Tablet: the same
        column, wider, on a lavender page. Laptop and up: the sidebar takes the
        left edge and the content takes **everything else** — no width cap.
        A capped column looked deliberate on a 1400px laptop and looked like a
        bug on a 1900px monitor, with a third of the screen spent on margin.
        Filling it is only worth doing if the screens have something to put
        there, which is why each one grows a second column rather than simply
        letting its text run to 1900px.
      */}
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-white sm:border-x sm:border-neutral-200 md:max-w-xl lg:max-w-none lg:flex-row lg:border-x-0">
        <SideNav current={screen} onChange={setScreen} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/*
            Deliberately not sticky. The screens have their own sticky headers,
            and two sticky bars at top-0 in one scroll container overlap —
            offsetting the second by the first's height means hard-coding a
            pixel number that breaks the moment the bar wraps.
          */}
          <div className="hidden border-b border-neutral-100 lg:block">
            <div className={CONTENT}>
              <div className="px-8 py-3">
                <BackupBar
                  variant="bar"
                  onToast={setToast}
                  onOpenData={() => setShowData(true)}
                />
              </div>
            </div>
          </div>

          <div className={`min-w-0 flex-1 ${CONTENT}`}>
            {screen === 'schedule' && <ScheduleScreen onToast={setToast} />}
            {screen === 'travel' && <TravelScreen onToast={setToast} />}
            {screen === 'expenses' && <ExpensesScreen onToast={setToast} />}
            {screen === 'reminders' && <RemindersScreen onToast={setToast} />}
            {screen === 'more' && <MoreScreen onToast={setToast} />}
          </div>
        </div>
      </div>

      {showData && <DataSheet onClose={() => setShowData(false)} onToast={setToast} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      <BottomNav current={screen} onChange={setScreen} />
    </>
  )
}
