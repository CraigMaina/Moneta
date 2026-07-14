/** A calm loading placeholder for the Settings account/category lists (no spinner). */
export function ManagerSkeleton() {
  return (
    <ul className="divide-y divide-ink-300/40">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-paper-50 motion-reduce:animate-none" />
          <span className="h-4 w-28 animate-pulse rounded-full bg-paper-50 motion-reduce:animate-none" />
        </li>
      ))}
    </ul>
  )
}
