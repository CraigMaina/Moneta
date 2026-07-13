import type { ReactNode } from 'react'
import { Button } from './Button'
import { cn } from '../../lib/cn'

export interface EmptyStateProps {
  /** A small icon glyph (see `./icons`) — decorative, so it's hidden from assistive tech. */
  icon?: ReactNode
  title: string
  /** One plain-voice line: what's missing and why, no jargon, no scolding. */
  description: string
  actionLabel: string
  onAction: () => void
  className?: string
}

/**
 * The pattern every empty list/chart/screen uses. Per CLAUDE.md: empty states
 * teach — name the action that fills them and offer the button to do it.
 */
export function EmptyState({ icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-4 px-6 py-10 text-center', className)}>
      {icon && (
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full bg-coral-100 text-coral-600"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="space-y-1">
        <h3 className="font-display text-[22px] font-semibold text-ink-900">{title}</h3>
        <p className="text-[15px] text-ink-600">{description}</p>
      </div>
      <Button onClick={onAction}>{actionLabel}</Button>
    </div>
  )
}
