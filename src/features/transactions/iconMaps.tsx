import type { ReactElement } from 'react'
import {
  AirtimeIcon,
  BankIcon,
  CashIcon,
  EatingOutIcon,
  EntertainmentIcon,
  GroceriesIcon,
  HomeIcon,
  OtherIcon,
  ShoppingIcon,
  TransportIcon,
  type IconProps,
} from '../../components/ui/icons'
import type { Account, Category } from './types'

/**
 * Maps the placeholder icon-name strings seeded onto `categories` (see
 * `supabase/seed.sql`, e.g. `'shopping-basket'`, `'utensils'`) onto the
 * design-system's actual glyph set (`src/components/ui/icons.tsx`, Phase 1
 * Brief B). Only a representative subset of category icons exists yet —
 * anything unmapped (Health, Education, Subscriptions, ...) falls back to
 * `OtherIcon` rather than inventing a new glyph unilaterally. See
 * DECISIONS.md.
 */
const CATEGORY_ICON_MAP: Record<string, (props: IconProps) => ReactElement> = {
  'shopping-basket': GroceriesIcon,
  utensils: EatingOutIcon,
  bus: TransportIcon,
  home: HomeIcon,
  signal: AirtimeIcon,
  'shopping-bag': ShoppingIcon,
  film: EntertainmentIcon,
}

export function categoryIcon(category: Pick<Category, 'icon'>): ReactElement {
  const Icon = (category.icon && CATEGORY_ICON_MAP[category.icon]) || OtherIcon
  return <Icon className="h-5 w-5" />
}

/**
 * Account-type glyphs. `AirtimeIcon` (a handset shape) doubles as the
 * M-PESA/mobile-money glyph rather than a new brand-specific icon.
 */
const ACCOUNT_ICON_MAP: Record<Account['type'], (props: IconProps) => ReactElement> = {
  mpesa: AirtimeIcon,
  cash: CashIcon,
  bank: BankIcon,
  other: OtherIcon,
}

export function accountIcon(account: Pick<Account, 'type'>): ReactElement {
  const Icon = ACCOUNT_ICON_MAP[account.type] ?? OtherIcon
  return <Icon className="h-5 w-5" />
}
