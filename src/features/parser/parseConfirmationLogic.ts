import type { AmountDisplayTone } from '../../components/ui/AmountDisplay'
import type { CategoryName, MpesaFamily, ParsedMpesaMessage, TransactionKind } from '../../parser/types'

/**
 * Pure presentation logic for the parse-confirmation card — no I/O, no
 * framework dependency, exhaustively unit-testable (mirrors the
 * `src/lib/safeToSpend.ts` discipline for this feature's own "must never
 * lie" surface: a transfer must never read as an expense, a withdrawal must
 * never read as a single expense).
 */

/** The one category every fee row lands in, per the row-splitting rule documented on `ParsedMpesaMessage` in `parser/types.ts`. */
export const FEE_CATEGORY_NAME: CategoryName = 'Fees & Fuliza charges'

const FAMILY_TITLES: Record<MpesaFamily, string> = {
  received: 'Money received',
  sent_to_person: 'Sent to person',
  paybill: 'PayBill payment',
  buy_goods: 'Buy Goods payment',
  pochi_la_biashara: 'Pochi la Biashara payment',
  withdrawal: 'Agent withdrawal',
  deposit: 'Agent deposit',
  airtime: 'Airtime purchase',
  fuliza_drawdown: 'Fuliza drawdown',
  fuliza_repayment: 'Fuliza repayment',
  mshwari_kcb_transfer: 'M-Shwari / KCB transfer',
  reversal: 'Reversal',
}

/** The card's small family caption, e.g. "Agent withdrawal", "PayBill payment". */
export function familyTitle(family: MpesaFamily): string {
  return FAMILY_TITLES[family]
}

/**
 * Tone for the primary amount. Income is `leaf`; expense AND transfer both
 * currently render in calm `ink` (CLAUDE.md gives coral no "danger" meaning,
 * and a transfer is never a spend) — but they're kept as DISTINCT tone
 * values rather than a transfer borrowing `'expense'`, so a transfer can
 * never be mistaken for an expense even if `AmountDisplay` later gives
 * `expense` its own visual treatment. See DECISIONS.md.
 */
export function amountTone(kind: TransactionKind): AmountDisplayTone {
  if (kind === 'income') return 'income'
  if (kind === 'transfer') return 'default'
  return 'expense'
}

export interface AccountOption {
  id: string
  name: string
  /** Matches `CounterAccountHint`'s vocabulary plus `'other'` — lets the card auto-select the right leg of a transfer without the caller having to do that matching itself. */
  type: 'mpesa' | 'cash' | 'bank' | 'other'
}

export interface ResolvedAccounts {
  accountId: string | null
  counterAccountId: string | null
}

/**
 * The default account(s) a parsed message's row should touch, resolved
 * purely from `counterAccountHint`/`transferDirection` (see the big
 * row-splitting doc comment on `ParsedMpesaMessage`) against the caller's
 * known accounts. Every family's primary leg is M-PESA — every message this
 * parser reads IS an M-PESA SMS. A transfer's counter leg is whichever
 * hinted account type actually exists in the caller's list; `null` when it
 * doesn't (e.g. accounts still loading, or the user has no Cash account) —
 * never guessed at a wrong id.
 */
export function resolveDefaultAccounts(
  parsed: Pick<ParsedMpesaMessage, 'kind' | 'family' | 'counterAccountHint' | 'transferDirection'>,
  accounts: readonly AccountOption[],
): ResolvedAccounts {
  const findByType = (type: AccountOption['type']) => accounts.find((account) => account.type === type)?.id ?? null
  const mpesaId = findByType('mpesa')

  // Reversal is `kind: 'transfer'` only as a safety marker (see types.ts) —
  // it has no real second account, so it's treated like every non-transfer
  // family here: M-PESA only, no counter leg.
  if (parsed.kind !== 'transfer' || parsed.family === 'reversal') {
    return { accountId: mpesaId, counterAccountId: null }
  }

  const { counterAccountHint: hint, transferDirection: direction } = parsed
  if (!hint || !direction) {
    return { accountId: mpesaId, counterAccountId: null }
  }

  const hintId = findByType(hint)
  return direction === 'mpesa_to_counter'
    ? { accountId: mpesaId, counterAccountId: hintId }
    : { accountId: hintId, counterAccountId: mpesaId }
}

const ACCOUNT_TYPE_LABEL: Record<AccountOption['type'], string> = {
  mpesa: 'M-PESA',
  cash: 'Cash',
  bank: 'Bank',
  other: 'Other',
}

export interface TransferHeadline {
  fromLabel: string
  toLabel: string
}

/**
 * The "{from} -> {to}" pair for a transfer family's headline (e.g.
 * "M-PESA -> Cash" for a withdrawal). Prefers the caller's real account name
 * when it's been resolved; falls back to a generic type label (still
 * truthful — "Cash", "Bank" — never a guessed name) when the account isn't
 * loaded yet. `null` for reversal (no real second account) and every
 * non-transfer family.
 */
export function transferHeadline(
  parsed: Pick<ParsedMpesaMessage, 'kind' | 'family' | 'counterAccountHint' | 'transferDirection'>,
  resolved: ResolvedAccounts,
  accounts: readonly AccountOption[],
): TransferHeadline | null {
  if (parsed.kind !== 'transfer' || parsed.family === 'reversal') return null
  const { counterAccountHint: hint, transferDirection: direction } = parsed
  if (!hint || !direction) return null

  const nameFor = (id: string | null, fallbackType: AccountOption['type']) =>
    accounts.find((account) => account.id === id)?.name ?? ACCOUNT_TYPE_LABEL[fallbackType]

  return direction === 'mpesa_to_counter'
    ? { fromLabel: nameFor(resolved.accountId, 'mpesa'), toLabel: nameFor(resolved.counterAccountId, hint) }
    : { fromLabel: nameFor(resolved.accountId, hint), toLabel: nameFor(resolved.counterAccountId, 'mpesa') }
}
