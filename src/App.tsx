import { useState } from 'react'
import BottomNav from './components/BottomNav'
import Toast from './components/Toast'
import RemindersScreen from './reminders/RemindersScreen'
import ExpensesScreen from './screens/ExpensesScreen'
import MoreScreen from './screens/MoreScreen'
import ScheduleScreen from './screens/ScheduleScreen'
import type { Screen } from './types'

export default function App() {
  const [screen, setScreen] = useState<Screen>('schedule')
  const [toast, setToast] = useState<string | null>(null)

  return (
    <>
      {/*
        Phone-shaped on purpose. On a wide screen the column sits on a soft grey
        page rather than floating in white, which reads as deliberate instead of
        unfinished.
      */}
      <div className="mx-auto min-h-[100dvh] max-w-md bg-white sm:border-x sm:border-neutral-200">
        {screen === 'schedule' && <ScheduleScreen onToast={setToast} />}
        {screen === 'expenses' && <ExpensesScreen />}
        {screen === 'reminders' && <RemindersScreen onToast={setToast} />}
        {screen === 'more' && <MoreScreen onToast={setToast} />}
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      <BottomNav current={screen} onChange={setScreen} />
    </>
  )
}
