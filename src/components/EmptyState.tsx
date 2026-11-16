/**
 * Nothing here yet. An emoji on a soft disc when one is given, so an empty
 * day still looks like part of a travel diary rather than a blank page.
 */
export default function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string
  hint?: string
  icon?: string
}) {
  return (
    <div className="py-16 text-center">
      {icon && (
        <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-sky-50 text-[30px]">
          {icon}
        </span>
      )}
      <p className="text-[15px] text-neutral-500">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-neutral-400">{hint}</p>}
    </div>
  )
}
