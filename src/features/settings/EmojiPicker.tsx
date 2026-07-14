import { cn } from '../../lib/cn'

/**
 * A compact emoji picker for custom categories & accounts. A curated grid
 * covers the common money/life cases at a tap; the field below accepts any
 * emoji the user's keyboard can produce (so nothing is locked out). Emoji-only
 * by design — the stored `icon` is rendered as-is by `iconMaps.tsx`.
 */

const SUGGESTED_EMOJI = [
  '🛒', '🍔', '🚗', '🏠', '📱', '🛍️', '🎬', '💊',
  '📚', '👨‍👩‍👧', '💡', '⛽', '☕', '🍺', '✈️', '🎁',
  '💰', '💵', '🏦', '📈', '💳', '🤝', '🙏', '🏋️',
  '🐄', '🌾', '🔧', '✂️', '🎓', '⚽', '🎵', '🐶',
]

export interface EmojiPickerProps {
  value: string | null
  onChange: (emoji: string | null) => void
  className?: string
}

export function EmojiPicker({ value, onChange, className }: EmojiPickerProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-8 gap-1.5">
        {SUGGESTED_EMOJI.map((emoji) => {
          const selected = value === emoji
          return (
            <button
              key={emoji}
              type="button"
              aria-label={`Use ${emoji}`}
              aria-pressed={selected}
              onClick={() => onChange(emoji)}
              className={cn(
                'flex h-10 items-center justify-center rounded-card text-[20px] leading-none transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-50',
                selected ? 'bg-coral-100 ring-1 ring-coral-600' : 'bg-paper-0 hover:bg-coral-100',
              )}
            >
              {emoji}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="text"
          value={value ?? ''}
          onChange={(event) => {
            const next = event.target.value.trim()
            onChange(next ? Array.from(next).slice(0, 2).join('') : null)
          }}
          placeholder="Or type any emoji"
          aria-label="Custom emoji"
          className="h-11 w-full rounded-card bg-paper-0 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="h-11 shrink-0 rounded-card px-3 text-[13px] font-semibold text-ink-600 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
