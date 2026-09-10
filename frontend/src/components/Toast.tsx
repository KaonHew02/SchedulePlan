import { useEffect } from 'react'

/** Brief confirmation, sitting just above the bottom nav. */
export default function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1900)
    return () => clearTimeout(timer)
  }, [message, onDone])

  return (
    <div className="fixed bottom-20 inset-x-0 z-40 flex justify-center pointer-events-none mb-safe">
      <div className="animate-fade-in rounded-full bg-neutral-900 px-4 py-2 text-[13px] text-white shadow-lg">
        {message}
      </div>
    </div>
  )
}
