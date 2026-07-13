import { useCallback, useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { cn } from '../../lib/cn'
import { CloseIcon } from './icons'

export interface SheetProps {
  open: boolean
  onClose: () => void
  /** Rendered as the sheet's visible heading and its accessible name. */
  title?: string
  children: ReactNode
  className?: string
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Not CLAUDE.md tokens — there isn't one for either. Smallest reasonable,
// deliberate values (a legible scrim, and a drag distance/speed that reads as
// an intentional dismiss rather than an accidental wobble). See DECISIONS.md.
const DRAG_CLOSE_OFFSET_PX = 120
const DRAG_CLOSE_VELOCITY_PX_PER_S = 500

/** Pure decision so the drag-to-dismiss threshold is unit-testable without simulating a real pointer gesture. */
// eslint-disable-next-line react-refresh/only-export-components -- pure threshold helper colocated with the component it guards; exported for its unit test
export function shouldDismissSheetDrag(offsetY: number, velocityY: number): boolean {
  return offsetY > DRAG_CLOSE_OFFSET_PX || velocityY > DRAG_CLOSE_VELOCITY_PX_PER_S
}

/**
 * The core interaction surface: a bottom sheet with drag-to-dismiss, a tap
 * backdrop, a focus trap, and Escape-to-close. Controlled (`open`/`onClose`).
 *
 * Never put an HTML `<form>` inside this — CLAUDE.md forbids form submission
 * inside sheets (it breaks the sheet UX and PWA behavior). Use buttons +
 * handlers for every action in `children`.
 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const prefersReducedMotion = useReducedMotion()
  const sheetRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // Capture the trigger, lock body scroll, and move focus in while open;
  // restore both the instant `open` flips back to false (independent of the
  // exit animation, so focus restore never waits on motion to finish).
  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const firstFocusable = sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(firstFocusable ?? sheetRef.current)?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused.current?.focus()
    }
  }, [open])

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !sheetRef.current) return

      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    },
    [onClose],
  )

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (shouldDismissSheetDrag(info.offset.y, info.velocity.y)) {
        onClose()
      }
    },
    [onClose],
  )

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            data-testid="sheet-backdrop"
            className="absolute inset-0 bg-ink-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className={cn(
              'relative z-10 w-full max-w-md rounded-t-sheet bg-paper-50 shadow-card',
              'max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]',
              className,
            )}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-ink-300" aria-hidden="true" />
            <div className="flex items-center justify-between px-4 pt-3">
              {title ? (
                <h2 id={titleId} className="font-display text-[22px] font-semibold text-ink-900">
                  {title}
                </h2>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink-600 hover:bg-paper-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-50"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 pb-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
