import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

export interface CategoryChipProps {
  /** A category glyph from `./icons` (or any 24x24 inline SVG), sized by the caller. */
  icon: ReactNode
  label: string
  selected: boolean
  onSelect: () => void
  className?: string
}

/**
 * A selectable category pill for the horizontal most-used-first scroller
 * (PRD §4.3). Height floors at 44px (the touch-target minimum) and grows with
 * its label; selection uses the same soft-fill treatment as the rest of the
 * kit (coral-100 well, coral-600 ink) rather than inventing a new color per
 * category — CLAUDE.md's palette has no per-category hue token, only the
 * shared semantic colors. See DECISIONS.md.
 */
export function CategoryChip({ icon, label, selected, onSelect, className }: CategoryChipProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={cn(
        'inline-flex h-11 flex-shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0',
        selected ? 'bg-coral-100 text-coral-600' : 'bg-paper-50 text-ink-600',
        className,
      )}
    >
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center" aria-hidden="true">
        {icon}
      </span>
      {label}
    </motion.button>
  )
}
