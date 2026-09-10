export default function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-[15px] text-neutral-500">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-neutral-400">{hint}</p>}
    </div>
  )
}
