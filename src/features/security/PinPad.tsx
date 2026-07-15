import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

/**
 * The 4-digit PIN entry primitive used by the lock screen and PIN setup (PRD
 * F11). Fixed 4 digits keeps setup and unlock simple and universal. Renders the
 * dots + a thumb-zone number pad; `onComplete` fires when the last digit lands
 * so the parent can verify from an event handler (no setState-in-effect).
 */
export const PIN_LENGTH = 4

export function PinPad({
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
}: {
  value: string
  onChange: (next: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  error?: boolean
}) {
  const prefersReducedMotion = useReducedMotion()

  const press = (digit: string) => {
    if (disabled || value.length >= PIN_LENGTH) return
    const next = value + digit
    onChange(next)
    if (next.length === PIN_LENGTH) onComplete?.(next)
  }
  const backspace = () => {
    if (disabled || value.length === 0) return
    onChange(value.slice(0, -1))
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        className="flex gap-4"
        animate={error && !prefersReducedMotion ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn(
              'h-3.5 w-3.5 rounded-full transition-colors',
              error ? 'bg-coral-600' : i < value.length ? 'bg-ink-900' : 'bg-ink-300/50',
            )}
          />
        ))}
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {keys.map((key) => (
          <PinKey key={key} onClick={() => press(key)} disabled={disabled}>
            {key}
          </PinKey>
        ))}
        <span aria-hidden="true" />
        <PinKey onClick={() => press('0')} disabled={disabled}>
          0
        </PinKey>
        <PinKey onClick={backspace} disabled={disabled || value.length === 0} label="Delete">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
            <path
              d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7Z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <path d="M12 10l4 4M16 10l-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </PinKey>
      </div>
    </div>
  )
}

function PinKey({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex h-16 w-16 items-center justify-center rounded-full text-[24px] font-semibold text-ink-900',
        'transition-colors hover:bg-paper-50 active:bg-paper-50 disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600',
      )}
    >
      {children}
    </button>
  )
}
