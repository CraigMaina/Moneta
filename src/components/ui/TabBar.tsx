import type { ReactElement } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { GoalsIcon, HomeIcon, InsightsIcon, PlusIcon, TransactionsIcon, type IconProps } from './icons'

export type TabId = 'home' | 'transactions' | 'goals' | 'insights'

export interface TabBarProps {
  /** Opens the Add sheet — this primitive doesn't own that sheet, just the press. */
  onAddPress: () => void
  /**
   * Forces which tab reads as active, ignoring the current route. For the
   * `/kitchen-sink` static gallery only — real usage should omit this and let
   * the current route decide.
   */
  activeOverride?: TabId
  /** `fixed` (default, real usage) or `static` (inline, for gallery display so it doesn't cover the page). */
  position?: 'fixed' | 'static'
  className?: string
}

interface NavItem {
  id: TabId
  label: string
  to: string
  Icon: (props: IconProps) => ReactElement
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', to: '/', Icon: HomeIcon },
  { id: 'transactions', label: 'Transactions', to: '/transactions', Icon: TransactionsIcon },
  { id: 'goals', label: 'Goals', to: '/goals', Icon: GoalsIcon },
  { id: 'insights', label: 'Insights', to: '/insights', Icon: InsightsIcon },
]

/**
 * The 5-slot bottom navigation: Home · Transactions · [+] Add · Goals ·
 * Insights, with a raised coral center Add button (the signature FAB-in-tab).
 * All targets are >= 44px in the thumb zone.
 */
export function TabBar({ onAddPress, activeOverride, position = 'fixed', className }: TabBarProps) {
  const location = useLocation()
  const prefersReducedMotion = useReducedMotion()

  const isActive = (item: NavItem) => (activeOverride ? activeOverride === item.id : location.pathname === item.to)

  const leading = NAV_ITEMS.slice(0, 2)
  const trailing = NAV_ITEMS.slice(2)

  return (
    <nav
      aria-label="Primary"
      className={cn(
        // min-h (not a fixed h-16) so the iOS home-indicator inset below adds to
        // the bar instead of eating into the 64px content area and clipping the
        // icons/labels (box-sizing is border-box).
        'flex min-h-16 items-stretch justify-between bg-paper-0 px-2 shadow-bar',
        position === 'fixed'
          ? 'fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]'
          : 'relative',
        className,
      )}
    >
      {leading.map((item) => (
        <TabLink key={item.id} item={item} active={isActive(item)} />
      ))}

      <div className="flex flex-1 items-center justify-center">
        <motion.button
          type="button"
          onClick={onAddPress}
          aria-label="Add transaction"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="relative -top-4 flex h-14 w-14 items-center justify-center rounded-full bg-coral-600 text-white shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0"
        >
          <PlusIcon className="h-6 w-6" />
        </motion.button>
      </div>

      {trailing.map((item) => (
        <TabLink key={item.id} item={item} active={isActive(item)} />
      ))}
    </nav>
  )
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const { Icon, label, to } = item
  return (
    <NavLink
      to={to}
      className="flex h-full min-w-11 flex-1 flex-col items-center justify-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0"
    >
      <Icon className={cn('h-6 w-6', active ? 'text-coral-600' : 'text-ink-600')} />
      <span className={cn('text-[12.5px]', active ? 'font-semibold text-coral-600' : 'text-ink-600')}>{label}</span>
    </NavLink>
  )
}
