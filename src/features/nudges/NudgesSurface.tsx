import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/cn'
import { RecurringEditorSheet, type RecurringPrefill } from '../recurring/RecurringEditorSheet'
import type { Nudge } from './nudgeRules'
import { useNudgeStore } from './nudgeStore'
import { useNudges } from './useNudges'

/**
 * Home nudge surface (PRD F9). Shows at most a couple of the most relevant
 * nudges as quiet cards; each can be dismissed, and a subscription suggestion
 * offers a one-tap "Track it" that opens the recurring editor prefilled. It's a
 * supplementary surface — renders nothing when there's nothing to say, and it
 * never adds a loading or error state to Home (CLAUDE.md: warns, never scolds).
 */
const MAX_VISIBLE = 2

export function NudgesSurface() {
  const nudges = useNudges()
  const dismiss = useNudgeStore((state) => state.dismiss)
  const prefersReducedMotion = useReducedMotion()
  const [prefill, setPrefill] = useState<RecurringPrefill | null>(null)

  const visible = nudges.slice(0, MAX_VISIBLE)
  if (visible.length === 0) return null

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {visible.map((nudge) => (
          <motion.div
            key={nudge.signature}
            layout={!prefersReducedMotion}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <NudgeCard
              nudge={nudge}
              onDismiss={() => dismiss(nudge.signature)}
              onTrack={
                nudge.action
                  ? () => {
                      const action = nudge.action!
                      setPrefill({
                        merchant: action.merchant,
                        amountCents: action.amountCents,
                        categoryId: action.categoryId,
                      })
                    }
                  : undefined
              }
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <RecurringEditorSheet open={prefill !== null} prefill={prefill ?? undefined} onClose={() => setPrefill(null)} />
    </div>
  )
}

function NudgeCard({
  nudge,
  onDismiss,
  onTrack,
}: {
  nudge: Nudge
  onDismiss: () => void
  onTrack?: () => void
}) {
  const isWarning = nudge.tone === 'warning'
  return (
    <Card className={cn('border-l-4', isWarning ? 'border-l-amber-600' : 'border-l-ink-300')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-[13px] font-semibold', isWarning ? 'text-amber-600' : 'text-ink-600')}>
            {nudge.title}
          </p>
          <p className="mt-1 text-[14px] leading-snug text-ink-900">{nudge.body}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {onTrack && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onTrack}
            className="rounded-full bg-coral-100 px-4 py-2 text-[13px] font-semibold text-coral-600 hover:bg-coral-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
          >
            Track it
          </button>
        </div>
      )}
    </Card>
  )
}
