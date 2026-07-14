import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { cn } from '../../lib/cn'
import { CheckIcon, CloseIcon, InfoIcon, WarnIcon } from './icons'

export type ToastVariant = 'success' | 'info' | 'warn'

export interface ToastAction {
  /** Short verb, e.g. "Undo". */
  label: string
  onClick: () => void
}

export interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  /** Auto-dismiss delay in ms. Default 4000. */
  durationMs?: number
  /** An optional inline action (e.g. "Undo" after a delete). Dismisses the toast once clicked. */
  action?: ToastAction
}

interface ToastRecord {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  durationMs: number
  action?: ToastAction
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION_MS = 4000
// Not a CLAUDE.md token — the smallest deliberate swipe distance that reads
// as an intentional dismiss rather than an accidental nudge. See DECISIONS.md.
const SWIPE_DISMISS_OFFSET_PX = 80

// eslint-disable-next-line react-refresh/only-export-components -- hook is colocated with its provider by design; HMR granularity is not a concern for a leaf primitive
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

const VARIANT_STYLES: Record<ToastVariant, { wellBg: string; icon: ReactNode }> = {
  success: { wellBg: 'bg-leaf-600/10', icon: <CheckIcon className="h-4 w-4 text-leaf-600" /> },
  info: { wellBg: 'bg-ink-900/5', icon: <InfoIcon className="h-4 w-4 text-ink-600" /> },
  warn: { wellBg: 'bg-amber-600/10', icon: <WarnIcon className="h-4 w-4 text-amber-600" /> },
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  const prefersReducedMotion = useReducedMotion()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remainingRef = useRef(toast.durationMs)
  // Set on mount by scheduleDismiss (below) before any reader runs; 0 keeps the
  // useRef initializer pure (no Date.now() during render).
  const startedAtRef = useRef(0)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const scheduleDismiss = useCallback(
    (ms: number) => {
      clearTimer()
      startedAtRef.current = Date.now()
      timerRef.current = setTimeout(() => onDismiss(toast.id), ms)
    },
    [clearTimer, onDismiss, toast.id],
  )

  useEffect(() => {
    scheduleDismiss(remainingRef.current)
    return clearTimer
    // Only (re)schedule on mount/unmount — pause/resume below manage timing explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pause = () => {
    remainingRef.current = Math.max(remainingRef.current - (Date.now() - startedAtRef.current), 0)
    clearTimer()
  }

  const resume = () => {
    scheduleDismiss(remainingRef.current || DEFAULT_DURATION_MS)
  }

  const variant = VARIANT_STYLES[toast.variant]

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > SWIPE_DISMISS_OFFSET_PX) {
      onDismiss(toast.id)
    }
  }

  return (
    <motion.div
      layout
      role="status"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
      onClick={() => onDismiss(toast.id)}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="pointer-events-auto flex w-[calc(100vw-32px)] max-w-sm cursor-pointer items-start gap-3 rounded-card bg-paper-0 p-3 shadow-card"
    >
      <span
        className={cn('mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full', variant.wellBg)}
        aria-hidden="true"
      >
        {variant.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink-900">{toast.title}</span>
        {toast.description && <span className="mt-0.5 block text-[12.5px] text-ink-600">{toast.description}</span>}
      </span>
      {/* Inline action (e.g. "Undo") — same keyboard/stopPropagation treatment
          as the dismiss button below so it doesn't double-fire the card's tap
          handler. Runs the action, then dismisses. */}
      {toast.action && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            toast.action?.onClick()
            onDismiss(toast.id)
          }}
          className="mt-0.5 flex-shrink-0 rounded-full px-2 py-1 text-[13px] font-semibold text-coral-600 hover:bg-coral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-1 focus-visible:ring-offset-paper-0"
        >
          {toast.action.label}
        </button>
      )}
      {/* Dedicated dismiss control so the toast is keyboard-operable and shows a
          visible focus ring — the surrounding role="status" node stays the live
          announcer, this button is the affordance. stopPropagation avoids a
          double-dismiss with the card's pointer-tap handler. */}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={(event) => {
          event.stopPropagation()
          onDismiss(toast.id)
        }}
        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-1 focus-visible:ring-offset-paper-0"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((options: ToastOptions) => {
    const id = `toast-${Math.random().toString(36).slice(2)}`
    setToasts((current) => [
      {
        id,
        title: options.title,
        description: options.description,
        variant: options.variant ?? 'info',
        durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
        action: options.action,
      },
      ...current,
    ])
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
