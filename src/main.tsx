import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initStore } from './lib/store'
import './index.css'

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
