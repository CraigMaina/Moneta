import { useEffect, useState } from 'react'
import { animate as animateValue, motion, useReducedMotion } from 'framer-motion'
import { AmountDisplay } from './AmountDisplay'
import { ProgressRing, clampProgress } from './ProgressRing'
import { RING_STROKE, heroNumeralPx, useResponsiveRingSize } from './heroRing'
import { formatKES } from '../../lib/money'
import { cn } from '../../lib/cn'

export interface DailySpendHeroProps {
  /** Today's target = the user's monthly category budgets ÷ days in the month. */
  dailyTargetCents: number
  /** Expense spend booked today (transfers/income already excluded). */
  spentTodayCents: number
  /** target − spent; negative once over today. */
  leftTodayCents: number
  /** True once today's spend has passed the target. */
  isOver: boolean
  className?: string
}

// Matches the safe-to-spend hero's reveal: a moment-of-meaning exception to the
// <=350ms ceiling, called out in the brief for the signature number.
const COUNT_UP_DURATION_S = 0.8

const BREATH_SCALE: [number, number, number] = [1, 1.015, 1]
const BREATH_DURATION_S = 3.2

/**
 * THE signature element: a daily spending gauge driven by the user's own
 * category budgets. The oversized numeral counts up to what's left to spend
 * today, with a breathing coral arc showing today's spend against the target.
 * Over-budget-for-today is a calm amber "KES X over today" — never a scary red
 * zero (mirrors the safe-to-spend hero's over state).
 *
 * The empty case (no budgets set) is handled by the caller, which teaches
 * instead of rendering a meaningless 0-target ring.
 */
export function DailySpendHero({
  dailyTargetCents,
  spentTodayCents,
  leftTodayCents,
  isOver,
  className,
}: DailySpendHeroProps) {
  const prefersReducedMotion = useReducedMotion()
  const { ref: wrapRef, ringSize } = useResponsiveRingSize()

  const [animatedCents, setAnimatedCents] = useState(0)
  useEffect(() => {
    if (isOver || prefersReducedMotion) return
    const controls = animateValue(0, leftTodayCents, {
      duration: COUNT_UP_DURATION_S,
      ease: 'easeOut',
      onUpdate: (value) => setAnimatedCents(Math.round(value)),
    })
    return () => controls.stop()
  }, [leftTodayCents, prefersReducedMotion, isOver])

  const displayCents = isOver ? 0 : prefersReducedMotion ? leftTodayCents : animatedCents
  const ringProgress = isOver ? 1 : clampProgress(dailyTargetCents > 0 ? spentTodayCents / dailyTargetCents : 0)

  // Size from the final value (not the animating one) so the count-up plays at
  // a stable size instead of resizing every frame.
  const numeralPx = heroNumeralPx(Math.abs(leftTodayCents), ringSize)

  return (
    <div ref={wrapRef} className={cn('flex flex-col items-center', className)}>
      <motion.div
        animate={prefersReducedMotion ? undefined : { scale: BREATH_SCALE }}
        transition={
          prefersReducedMotion ? undefined : { duration: BREATH_DURATION_S, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        <ProgressRing
          progress={ringProgress}
          size={ringSize}
          strokeWidth={RING_STROKE}
          fillColor={isOver ? 'var(--amber-600)' : 'var(--coral-600)'}
        >
          {isOver ? (
            <div className="flex flex-col items-center px-6 text-center">
              <p className="text-[15px] font-medium text-ink-600">You&apos;re</p>
              <p className="mt-1 whitespace-nowrap leading-none">
                <span className="mr-1.5 align-top font-display text-[22px] font-semibold text-ink-600">KES</span>
                <AmountDisplay
                  cents={Math.abs(leftTodayCents)}
                  size="hero"
                  tone="warning"
                  withSymbol={false}
                  style={{ fontSize: numeralPx }}
                />
              </p>
              <p className="mt-1 text-[15px] font-medium text-ink-600">over today</p>
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 text-center">
              <p className="text-[15px] font-medium text-ink-600">Left to spend today</p>
              <p className="mt-1 whitespace-nowrap leading-none">
                <span className="mr-1.5 align-top font-display text-[22px] font-semibold text-ink-600">KES</span>
                <AmountDisplay
                  cents={displayCents}
                  size="hero"
                  tone="default"
                  withSymbol={false}
                  style={{ fontSize: numeralPx }}
                />
              </p>
              <p className="mt-1 text-[13px] text-ink-600">of {formatKES(dailyTargetCents)}</p>
            </div>
          )}
        </ProgressRing>
      </motion.div>
      <p className="mt-3 text-[13px] text-ink-600">
        Spent <span className="font-semibold text-ink-900">{formatKES(spentTodayCents)}</span> today
      </p>
    </div>
  )
}
