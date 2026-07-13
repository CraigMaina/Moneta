import { forwardRef, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

export interface CardProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    'onAnimationStart' | 'onAnimationEnd' | 'onDrag' | 'onDragStart' | 'onDragEnd'
  > {
  /** Makes the card a pressable surface (role="button", keyboard-activatable, tap spring). */
  interactive?: boolean
  children: ReactNode
}

/**
 * The `--paper-0` surface card: soft shadow, 16px radius, depth via shadow
 * (never a border). Padding sits on the 4px grid.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive = false, onClick, onKeyDown, className, children, ...rest },
  ref,
) {
  const prefersReducedMotion = useReducedMotion()

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (!interactive) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick?.(event as unknown as MouseEvent<HTMLDivElement>)
    }
  }

  return (
    <motion.div
      ref={ref}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      whileTap={interactive && !prefersReducedMotion ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={cn(
        'rounded-card bg-paper-0 p-4 shadow-card',
        interactive &&
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  )
})
