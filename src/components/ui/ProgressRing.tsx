import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

/** Clamps a progress fraction to the valid 0-1 range, guarding against NaN/Infinity from an upstream division-by-zero. */
// eslint-disable-next-line react-refresh/only-export-components -- pure clamp helper colocated with the component it guards; exported for its unit test
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export interface ProgressRingProps {
  /** 0-1, clamped defensively — see `clampProgress`. */
  progress: number
  /** Diameter in px. Default 120. */
  size?: number
  /** Stroke width in px. Default 10. */
  strokeWidth?: number
  /** Default a faint coral-100 track. */
  trackColor?: string
  /** Default coral-600 fill. */
  fillColor?: string
  /** Optional accessible label. When omitted, the ring is treated as decorative (its `children`, if any, carry the accessible text). */
  label?: string
  children?: ReactNode
  className?: string
}

/**
 * The goals-ring primitive and the basis for the safe-to-spend hero's arc.
 * Fill animates on change with a spring; `prefers-reduced-motion` jumps
 * straight to the final value instead.
 */
export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  trackColor = 'var(--coral-100)',
  fillColor = 'var(--coral-600)',
  label,
  children,
  className,
}: ProgressRingProps) {
  const prefersReducedMotion = useReducedMotion()
  const clamped = clampProgress(progress)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clamped)

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: dashOffset }}
          transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 24 }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  )
}
