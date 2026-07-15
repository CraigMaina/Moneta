import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/**
 * A one-time goal-reached celebration (PRD F7: "confetti restraint — once,
 * tasteful, respects reduced-motion"). A short burst of pieces from the centre;
 * `onDone` fires when the burst finishes so the parent can clear it. Under
 * `prefers-reduced-motion` the pieces don't fly — a single calm fade stands in,
 * and `onDone` still fires so nothing gets stuck.
 */

const COLORS = ['#e8474b', '#e0a044', '#2fa06a', '#5b8def', '#b06fd6']
const PIECE_COUNT = 28

export interface ConfettiProps {
  show: boolean
  onDone: () => void
}

export function Confetti({ show, onDone }: ConfettiProps) {
  const prefersReducedMotion = useReducedMotion()

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => ({
        id: i,
        color: COLORS[i % COLORS.length],
        angle: (i / PIECE_COUNT) * Math.PI * 2,
        distance: 90 + (i % 5) * 26,
        rotate: (i % 2 === 0 ? 1 : -1) * (120 + (i % 4) * 60),
      })),
    [],
  )

  return createPortal(
    <AnimatePresence onExitComplete={onDone}>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden="true"
        >
          {prefersReducedMotion ? (
            <motion.div
              className="h-24 w-24 rounded-full"
              style={{ background: 'radial-gradient(circle, var(--coral-100), transparent 70%)' }}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1.2, opacity: [0, 1, 0] }}
              transition={{ duration: 0.9 }}
              onAnimationComplete={onDone}
            />
          ) : (
            pieces.map((piece) => (
              <motion.span
                key={piece.id}
                className="absolute h-2.5 w-2.5 rounded-[2px]"
                style={{ backgroundColor: piece.color }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                animate={{
                  x: Math.cos(piece.angle) * piece.distance,
                  y: Math.sin(piece.angle) * piece.distance + 40,
                  opacity: [1, 1, 0],
                  rotate: piece.rotate,
                  scale: 0.6,
                }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
                onAnimationComplete={piece.id === 0 ? onDone : undefined}
              />
            ))
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
