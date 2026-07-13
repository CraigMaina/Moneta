import { useEffect, useState } from 'react'
import { animate as animateValue, motion, useReducedMotion } from 'framer-motion'
import { AmountDisplay } from './AmountDisplay'
import { ProgressRing, clampProgress } from './ProgressRing'
import { cn } from '../../lib/cn'

export interface SafeToSpendHeroProps {
  /** Can go negative — the "over this month" state. Never a stored/mutable value, always derived. */
  safeToSpendCents: number
  spentTodayCents: number
  /** The daily allowance the arc measures today's spend against. */
  dailyBudgetCents: number
  className?: string
}

// Count-up duration/easing: a moment-of-meaning exception to CLAUDE.md's
// <=350ms motion ceiling (explicitly called out in the brief for this one
// element). 800ms tween easeOut reads as a confident reveal without feeling
// slow. Not a token — see DECISIONS.md.
const COUNT_UP_DURATION_S = 0.8

// The arc "breathes" — a very subtle, slow, looping scale pulse so the hero
// reads as alive rather than static. 1.5% amplitude over a a slow 3.2s cycle
// is deliberately understated; anything larger would compete with the count-up
// for attention. Not a token — see DECISIONS.md.
const BREATH_SCALE: [number, number, number] = [1, 1.015, 1]
const BREATH_DURATION_S = 3.2

const RING_SIZE = 260
const RING_STROKE = 16

/**
 * THE signature element (PRD §4.5/§8, CLAUDE.md "Signature"). An oversized
 * tabular numeral counts up to its value on load with a breathing coral arc
 * behind it showing today's spend against the daily allowance. Everything
 * else on Home stays quiet so this one moment carries the screen.
 *
 * Negative case: never a scary red zero — a calm, amber, "You're over this
 * month" message replaces the numeral. `prefers-reduced-motion` skips the
 * count-up and the breathing; both render their final state immediately.
 */
export function SafeToSpendHero({
  safeToSpendCents,
  spentTodayCents,
  dailyBudgetCents,
  className,
}: SafeToSpendHeroProps) {
  const prefersReducedMotion = useReducedMotion()
  const isOver = safeToSpendCents < 0

  // Only the animated count-up needs component state — the reduced-motion and
  // "over this month" cases are computed directly at render time below, so
  // the effect's only job is subscribing to Framer's animation ticker (the
  // "external system"), never calling setState synchronously in its own body.
  const [animatedCents, setAnimatedCents] = useState(0)

  useEffect(() => {
    if (isOver || prefersReducedMotion) return
    const controls = animateValue(0, safeToSpendCents, {
      duration: COUNT_UP_DURATION_S,
      ease: 'easeOut',
      onUpdate: (value) => setAnimatedCents(Math.round(value)),
    })
    return () => controls.stop()
  }, [safeToSpendCents, prefersReducedMotion, isOver])

  const displayCents = isOver ? 0 : prefersReducedMotion ? safeToSpendCents : animatedCents

  const spendRatio = dailyBudgetCents > 0 ? clampProgress(spentTodayCents / dailyBudgetCents) : 0
  const ringProgress = isOver ? 1 : spendRatio

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <motion.div
        animate={prefersReducedMotion ? undefined : { scale: BREATH_SCALE }}
        transition={
          prefersReducedMotion ? undefined : { duration: BREATH_DURATION_S, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        <ProgressRing
          progress={ringProgress}
          size={RING_SIZE}
          strokeWidth={RING_STROKE}
          fillColor={isOver ? 'var(--amber-600)' : 'var(--coral-600)'}
        >
          {isOver ? (
            <div className="flex flex-col items-center px-6 text-center">
              <p className="text-[15px] font-medium text-ink-600">You&apos;re</p>
              {/* KES mark de-emphasized so the numeral carries the moment (mirrors the Keypad). */}
              <p className="mt-1 leading-none">
                <span className="mr-1.5 align-top font-display text-[22px] font-semibold text-ink-600">KES</span>
                <AmountDisplay cents={Math.abs(safeToSpendCents)} size="hero" tone="warning" withSymbol={false} />
              </p>
              <p className="mt-1 text-[15px] font-medium text-ink-600">over this month</p>
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 text-center">
              <p className="text-[15px] font-medium text-ink-600">Safe to spend today</p>
              <p className="mt-1 leading-none">
                <span className="mr-1.5 align-top font-display text-[22px] font-semibold text-ink-600">KES</span>
                <AmountDisplay cents={displayCents} size="hero" tone="default" withSymbol={false} />
              </p>
            </div>
          )}
        </ProgressRing>
      </motion.div>
    </div>
  )
}
