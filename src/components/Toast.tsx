import { useEffect } from 'react'

/**
 * Brief confirmation, sitting just above the tab bar and clear of its raised +.
 * Over the sheets too (z-[60] against their 50): Export and To Drive are
 * pressed from inside the More sheet, and a toast drawn under it was never seen.
 */
export default function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1900)
    return () => clearTimeout(timer)
  }, [message, onDone])

  return (
    <div className="fixed bottom-24 inset-x-0 lg:bottom-20 z-[60] flex justify-center pointer-events-none mb-safe">
      <div className="animate-fade-in rounded-full bg-neutral-900 px-4 py-2 text-[13px] text-white shadow-lg">
        {message}
      </div>
    </div>
  )
}
