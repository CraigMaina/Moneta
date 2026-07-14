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

/** A user-picked emoji rendered as a glyph (custom categories/accounts store an emoji in `icon`). */
function emojiGlyph(emoji: string): ReactElement {
  return (
    <span className="text-[18px] leading-none" role="img" aria-hidden="true">
      {emoji}
    </span>
  )
}

/**
 * True for a user-picked emoji, false for a seeded placeholder icon-NAME
 * (e.g. 'smartphone', 'shopping-basket'). Seeded names are ASCII slugs; emoji
 * fall outside that set, so this cleanly tells a custom emoji from a slug we'd
 * otherwise render as literal text.
 */
function looksLikeEmoji(icon: string): boolean {
  return !/^[a-z0-9_-]+$/i.test(icon)
}

export function categoryIcon(category: Pick<Category, 'icon'>): ReactElement {
  const icon = category.icon
  if (icon) {
    const Mapped = CATEGORY_ICON_MAP[icon]
    if (Mapped) return <Mapped className="h-5 w-5" />
    // A custom category stores a picked emoji (not a seeded placeholder name).
    if (looksLikeEmoji(icon)) return emojiGlyph(icon)
  }
  return <OtherIcon className="h-5 w-5" />
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

export function accountIcon(account: Pick<Account, 'type' | 'icon'>): ReactElement {
  // A user-picked emoji wins over the type default; a seeded placeholder
  // icon-name ('smartphone', ...) is ignored in favour of the type glyph.
  if (account.icon && looksLikeEmoji(account.icon)) return emojiGlyph(account.icon)
  const Icon = ACCOUNT_ICON_MAP[account.type] ?? OtherIcon
  return <Icon className="h-5 w-5" />
}
