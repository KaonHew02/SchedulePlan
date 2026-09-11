import { useState } from 'react'
import BottomNav from './components/BottomNav'
import SideNav from './components/SideNav'
import Toast from './components/Toast'
import ExpensesScreen from './expenses/ExpensesScreen'
import RemindersScreen from './reminders/RemindersScreen'
import MoreScreen from './screens/MoreScreen'
import ScheduleScreen from './screens/ScheduleScreen'
import type { Screen } from './types'

export default function App() {
  const [screen, setScreen] = useState<Screen>('schedule')
  const [toast, setToast] = useState<string | null>(null)

  return (
    <>
      {/*
        Three shapes, one tree. Phone: full bleed, bottom nav. Tablet: the same
        column, wider, on a grey page. Laptop and up: the column moves beside a
        sidebar and the bottom bar goes away.
      */}
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-white sm:border-x sm:border-neutral-200 md:max-w-xl lg:max-w-4xl lg:flex-row">
        <SideNav current={screen} onChange={setScreen} />

        <div className="min-w-0 flex-1">
          {screen === 'schedule' && <ScheduleScreen onToast={setToast} />}
          {screen === 'expenses' && <ExpensesScreen onToast={setToast} />}
          {screen === 'reminders' && <RemindersScreen onToast={setToast} />}
          {screen === 'more' && <MoreScreen onToast={setToast} />}
        </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      <BottomNav current={screen} onChange={setScreen} />
    </>
  )
}
