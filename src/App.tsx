import { useState } from 'react'
import BottomNav from './components/BottomNav'
import Toast from './components/Toast'
import ExpensesScreen from './screens/ExpensesScreen'
import MoreScreen from './screens/MoreScreen'
import ScheduleScreen from './screens/ScheduleScreen'
import type { Screen } from './types'

export default function App() {
  const [screen, setScreen] = useState<Screen>('schedule')
  const [toast, setToast] = useState<string | null>(null)

  return (
    <div className="min-h-[100dvh]">
      {screen === 'schedule' && <ScheduleScreen onToast={setToast} />}
      {screen === 'expenses' && <ExpensesScreen />}
      {screen === 'more' && <MoreScreen onToast={setToast} />}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      <BottomNav current={screen} onChange={setScreen} />
    </div>
  )
}
