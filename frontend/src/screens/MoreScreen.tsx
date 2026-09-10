import Logo from '../components/Logo'

export default function MoreScreen() {
  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-md px-5 pt-4 pb-3">
          <h1 className="text-[19px] font-semibold tracking-tight">More</h1>
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 pb-28">
        <p className="py-16 text-center text-[15px] leading-6 text-neutral-500">
          Currency converter, bill split, documents, categories and settings
          arrive in later phases.
        </p>
        <div className="flex flex-col items-center gap-2">
          <Logo size={44} />
          <p className="text-[14px] font-medium tracking-tight">SchedulePlan</p>
          <p className="text-[13px] text-neutral-300">Version 0.1</p>
        </div>
      </main>
    </>
  )
}
