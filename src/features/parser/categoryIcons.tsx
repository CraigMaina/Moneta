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
  TagIcon,
  TransportIcon,
  type IconProps,
} from '../../components/ui/icons'
import type { CategoryName } from '../../parser/types'
import type { AccountOption } from './parseConfirmationLogic'

/**
 * Category-NAME -> glyph for the parse-confirmation card. The parser's
 * output carries a stable category *name* (`ParsedMpesaMessage.category`),
 * not a db id/icon string, so this keys directly off `CategoryName` rather
 * than reusing `transactions/iconMaps.tsx` (which maps the seeded
 * `categories.icon` placeholder strings). Only the same representative
 * subset Phase 1 already drew has a dedicated glyph — everything else
 * (Health, Education, Family & Black Tax, Chama & Savings-out,
 * Subscriptions, Fees & Fuliza charges, Giving/Tithe, every Income category)
 * falls back to `OtherIcon`, matching that phase's own documented
 * "representative subset, not exhaustive" decision. See DECISIONS.md.
 */
const CATEGORY_ICON_MAP: Partial<Record<CategoryName, (props: IconProps) => ReactElement>> = {
  'Food & Groceries': GroceriesIcon,
  'Eating Out': EatingOutIcon,
  Transport: TransportIcon,
  'Rent & Utilities': HomeIcon,
  'Airtime & Data': AirtimeIcon,
  Shopping: ShoppingIcon,
  Entertainment: EntertainmentIcon,
}

export function categoryNameIcon(name: CategoryName | null): ReactElement {
  const Icon = (name && CATEGORY_ICON_MAP[name]) || OtherIcon
  return <Icon className="h-5 w-5" />
}

/** The "no category yet" prompt chip's glyph — a tag, not a fallback category icon, so it reads as "pick one" rather than "Other". */
export function pickCategoryIcon(): ReactElement {
  return <TagIcon className="h-5 w-5" />
}

const ACCOUNT_TYPE_ICON: Record<AccountOption['type'], (props: IconProps) => ReactElement> = {
  // AirtimeIcon (a handset shape) doubles as the M-PESA/mobile-money glyph,
  // matching the existing `transactions/iconMaps.tsx` precedent.
  mpesa: AirtimeIcon,
  cash: CashIcon,
  bank: BankIcon,
  other: OtherIcon,
}

export function accountTypeIcon(type: AccountOption['type']): ReactElement {
  const Icon = ACCOUNT_TYPE_ICON[type] ?? OtherIcon
  return <Icon className="h-5 w-5" />
}
