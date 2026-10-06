import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerOffline } from './lib/offline'
import { initStore } from './lib/store'
import { installSpeedBumps } from './lib/tamper'
import './index.css'

// Built site only: in development the tools and the console are for working in.
if (import.meta.env.PROD) installSpeedBumps()

// Keep a copy of the app itself, so it opens with no signal. Also built site only.
registerOffline()

const root = createRoot(document.getElementById('root')!)

/**
 * Read the notebook off disk before drawing anything.
 *
 * IndexedDB is asynchronous, so the alternative is rendering an empty app for
 * a frame and filling it in afterwards — which, to someone opening a notebook
 * they have been keeping for months, looks exactly like losing it.
 */
initStore()
  .catch(() => {
    // A browser that will not open its own database still gets a usable app
    // for this session. The backup bar in More reports what went wrong.
  })
  .finally(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
