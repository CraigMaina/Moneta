import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

export interface ParseTransformProps {
  /** The raw SMS text as pasted/shared — shown, quiet and unstyled, until `parsed` flips true. */
  rawText: string
  /** True once a parse result is ready to render as `children` (the confirmation card). False shows the raw message only. */
  parsed: boolean
  /** The confirmation card (or any structured content) revealed once `parsed` is true. */
  children: ReactNode
  className?: string
}

/**
 * The signature "raw SMS -> transaction card" wow moment (PRD F1/F2): the
 * pasted message dissolves out while the structured card settles in on a
 * spring (stiffness 260 / damping 24, matching every other moment-of-meaning
 * transition in the design system — Sheet, Card, ProgressRing). Calm, not
 * flashy: one crossfade, no confetti, no bounce.
 *
 * `prefers-reduced-motion` skips straight to whichever stage is current —
 * an instant swap, no dissolve, no spring — per CLAUDE.md.
 */
export function ParseTransform({ rawText, parsed, children, className }: ParseTransformProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{parsed ? children : <RawMessagePreview text={rawText} />}</div>
  }

  return (
    <div className={cn('relative', className)}>
      <AnimatePresence mode="wait" initial={false}>
        {!parsed ? (
          <motion.div
            key="raw"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97, filter: 'blur(3px)' }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <RawMessagePreview text={rawText} />
          </motion.div>
        ) : (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RawMessagePreview({ text }: { text: string }) {
  return (
    <div className="rounded-card bg-paper-50 p-4">
      <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Reading your message</p>
      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-600">{text}</p>
    </div>
  )
}
