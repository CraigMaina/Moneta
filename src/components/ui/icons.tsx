/**
 * Small local inline-SVG icon set for app chrome (TabBar, Toast, EmptyState).
 *
 * Deliberately not an external icon dependency (e.g. lucide-react) — CLAUDE.md
 * asks to prefer inline SVG and record any external icon dependency in
 * DECISIONS.md. A handful of 24x24 stroke icons is small enough to own
 * directly and keeps the primitive kit dependency-free.
 */
export interface IconProps {
  className?: string
}

const BASE_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5a2 2 0 1 1 4 0v5h3a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

export function TransactionsIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M6 4h9a2 2 0 0 1 2 2v14l-2.5-1.5L12 20l-2.5-1.5L7 20l-2.5-1.5L2 20V6a2 2 0 0 1 2-2h2Z" />
      <path d="M7 9h8M7 13h8" />
    </svg>
  )
}

export function GoalsIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function InsightsIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 20V10M12 20V4M20 20v-6" />
    </svg>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  )
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z" />
    </svg>
  )
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M4.6 19.4 6 18M18 6l1.4-1.4" />
    </svg>
  )
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.83-2.83L5 17v3Z" />
      <path d="M14 8l2.5 2.5" />
    </svg>
  )
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function LogOutIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M15 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9" />
      <path d="M18 15l3-3-3-3M21 12H10" />
    </svg>
  )
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function WarnIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M12 3.5 21 19.5H3L12 3.5Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ReceiptIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M6 3h12v18l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21V3Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  )
}

export function BackspaceIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M9 5h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7Z" />
      <path d="M13 10.5 17 14M17 10.5 13 14" />
    </svg>
  )
}

/*
 * Category glyphs — a representative subset of the PRD §4.3 default category
 * set (most-used-first: Groceries, Eating Out, Transport, Airtime, Shopping,
 * Entertainment, Other), enough to exercise `CategoryChip` in every state.
 * Rent & Utilities reuses `HomeIcon` below rather than a near-duplicate house
 * glyph. The full category icon set is deferred to the categories feature
 * (Phase 2) — see DECISIONS.md.
 */

export function GroceriesIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 9h16l-1.4 10.3a2 2 0 0 1-2 1.7H7.4a2 2 0 0 1-2-1.7L4 9Z" />
      <path d="M8 9V7a4 4 0 0 1 8 0v2" />
    </svg>
  )
}

export function EatingOutIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M6 3v6a1.5 1.5 0 0 0 3 0V3M7.5 3v18" />
      <path d="M17 3c-1.4 0-2.5 1.8-2.5 5s1.1 4 2.5 4v9" />
    </svg>
  )
}

export function TransportIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 16V10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6" />
      <path d="M4 16h16M6 8l1.4-4h9L18 8" />
      <circle cx="7.5" cy="18.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="18.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function AirtimeIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </svg>
  )
}

export function ShoppingIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

export function EntertainmentIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 9l5 3-5 3V9Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function OtherIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

/*
 * Account-type glyphs, added for the manual-entry sheet's account chips
 * (Phase 2). `AirtimeIcon` above already reads as a handset, so it doubles as
 * the M-PESA/mobile-money glyph; these two cover Cash and Bank, the other two
 * seeded account types. See DECISIONS.md.
 */

export function CashIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 9h.01M17.5 15h.01" />
    </svg>
  )
}

export function BankIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 10 12 4l8 6" />
      <path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9" />
      <path d="M3 21h18" />
    </svg>
  )
}

/*
 * Added for the Transactions list screen (Phase 2): a search field glyph, and
 * the two swipe/quick-action glyphs (recategorize, delete). See DECISIONS.md.
 */

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  )
}

export function TagIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M12.5 3H19a2 2 0 0 1 2 2v6.5a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-6.5-6.5a2 2 0 0 1 0-2.8l8-8A2 2 0 0 1 12.5 3Z" />
      <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M7 7l1 12.5A2 2 0 0 0 10 21h4a2 2 0 0 0 2-1.5L17 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

/*
 * Added for the parse-confirmation card (Phase 3): the small connector glyph
 * for a transfer's "M-PESA -> Cash" headline. See DECISIONS.md.
 */

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 12h16M13 6l6 6-6 6" />
    </svg>
  )
}
