import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'md' | 'lg'

export interface ButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'onAnimationStart' | 'onAnimationEnd' | 'onDrag' | 'onDragStart' | 'onDragEnd'
  > {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Stretches the button to fill its container — used for thumb-zone primary actions. */
  fullWidth?: boolean
  /** Shows a spinner in place of the label and disables the button, without changing its width. */
  loading?: boolean
  children: ReactNode
}

// Buttons use Tailwind's built-in `rounded-full` rather than a px radius —
// CLAUDE.md only tokenizes radius for cards (16px) and sheets (24px), not
// buttons, and a relative (fully-rounded) value needs no invented pixel
// figure. See DECISIONS.md.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-coral-600 text-white hover:bg-coral-500 active:bg-coral-500 disabled:bg-ink-300 disabled:text-paper-0',
  secondary:
    'bg-paper-50 text-ink-900 hover:shadow-card active:bg-paper-50 disabled:bg-paper-50 disabled:text-ink-300',
  ghost: 'bg-transparent text-ink-600 hover:bg-paper-50 hover:text-ink-900 active:bg-paper-50 disabled:text-ink-300',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'h-12 px-5 text-[15px]',
  lg: 'h-14 px-6 text-[15px]',
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Primary interactive control. Variants: `primary` (coral fill, the thumb-zone
 * default), `secondary` (quiet paper-well fill), `ghost` (text-only chrome
 * action). No `destructive` variant — see DECISIONS.md for why.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth = false, loading = false, disabled, type, className, children, ...rest },
  ref,
) {
  const prefersReducedMotion = useReducedMotion()
  const isDisabled = Boolean(disabled) || loading

  return (
    <motion.button
      ref={ref}
      type={type ?? 'button'}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      whileTap={isDisabled || prefersReducedMotion ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 rounded-full font-semibold',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0',
        'disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </motion.button>
  )
})
