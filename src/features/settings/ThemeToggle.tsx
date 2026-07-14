import { cn } from '../../lib/cn'
import { MoonIcon, SunIcon } from '../../components/ui/icons'
import { useThemeStore, type ThemePreference } from './themeStore'

/**
 * Light / System / Dark segmented control. "System" defers to the OS (the CSS
 * media query in index.css); the explicit options override it. Reads and
 * writes the persisted theme store — no local state, so it stays in sync if
 * the preference is ever changed elsewhere.
 */

const OPTIONS: { value: ThemePreference; label: string; icon?: 'sun' | 'moon' }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
]

export function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex gap-1 rounded-full bg-paper-0 p-1"
    >
      {OPTIONS.map((option) => {
        const active = preference === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(option.value)}
            className={cn(
              'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-50',
              active ? 'bg-coral-600 text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {option.icon === 'sun' && <SunIcon className="h-4 w-4" />}
            {option.icon === 'moon' && <MoonIcon className="h-4 w-4" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
