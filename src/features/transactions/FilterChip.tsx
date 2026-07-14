import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

export interface FilterChipProps {
  label: string
  active: boolean
  onSelect: () => void
  /** Optional glyph — unlike `CategoryChip`, no icon slot is reserved when omitted (needed for text-only "All" chips). */
  icon?: ReactNode
  className?: string
}

/**
 * A selectable filter pill for the Transactions list's kind/account/category
 * rows. Visually identical to `CategoryChip`'s soft-fill treatment
 * (coral-100/coral-600 selected, paper-50/ink-600 unselected) but doesn't
 * force an icon slot — filter rows need a text-only "All" chip alongside
 * icon-bearing ones, and reserving empty icon space for "All" would look
 * unbalanced. Kept local to this feature rather than promoted to
 * `components/ui/` since it's a minor variant of an existing primitive, not
 * a new one. See DECISIONS.md.
 */
export function FilterChip({ label, active, onSelect, icon, className }: FilterChipProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={cn(
        'inline-flex h-11 flex-shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0',
        active ? 'bg-coral-100 text-coral-600' : 'bg-paper-50 text-ink-600',
        className,
      )}
    >
      {icon && (
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center" aria-hidden="true">
          {icon}
        </span>
      )}
      {label}
    </motion.button>
  )
}
