import { getDaysInMonth } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { NAIROBI_TZ } from '../../lib/safeToSpend'
import { formatKES } from '../../lib/money'
import { daysBetween } from '../../lib/streaks'
import { toNairobiDateString } from '../transactions/nairobiDate'
import { nairobiMonthKey, recentMonthKeys } from '../insights/insightsMath'
import type { Transaction } from '../transactions/types'

/**
 * Pure rule-based nudge engine (PRD F9). No I/O — transactions in, structured
 * nudges out; `formatKES` is the only formatting and it's a display-edge lib
 * (CLAUDE.md). Three rules, all derived from data the app already has (no
 * budgets table exists, so "pace" baselines against the category's own recent
 * average rather than a set budget):
 *
 *   1. category-pace  — a category is well ahead of its usual monthly spend.
 *   2. subscription   — a merchant charges ~the same amount ~monthly and isn't
 *                       tracked as a recurring bill yet.
 *   3. unusual-spend  — a recent expense is far larger than the user's typical
 *                       spend in that category.
 *
 * Tone is warm and factual — Moneta warns and remembers, it never scolds
 * (CLAUDE.md). Copy states the fact and, where useful, offers the next action;
 * it never uses guilt or exclamation.
 *
 * Every amount is integer cents; ratios/medians are used only for comparison
 * and never fed back into stored money.
 */

export type NudgeKind = 'category-pace' | 'subscription' | 'unusual-spend'
export type NudgeTone = 'warning' | 'info'

export interface NudgeAddRecurringAction {
  kind: 'add-recurring'
  merchant: string
  amountCents: number
  categoryId: string | null
}

export interface Nudge {
  /** Stable signature for de-duplication and session dismissal. */
  signature: string
  kind: NudgeKind
  tone: NudgeTone
  title: string
  body: string
  /** Optional prefill the surface can wire to a one-tap action. */
  action?: NudgeAddRecurringAction
}

export interface NudgeInputs {
  transactions: Transaction[]
  /** For labelling category-scoped nudges. */
  categoryNameById: Map<string, string>
  /** Normalized (lowercased, trimmed) merchant names already tracked as recurring items. */
  recurringMerchants: Set<string>
  now: Date
  timeZone?: string
}

// --- Thresholds (named so the intent is legible and tests can pin them). ---
const PACE_BASELINE_MONTHS = 3
const PACE_MIN_BASELINE_CENTS = 200_000 // KES 2,000 — ignore trivial categories
const PACE_TRIGGER_FRACTION = 0.8

const SUB_WINDOW_DAYS = 75
const SUB_MIN_OCCURRENCES = 2
const SUB_AMOUNT_TOLERANCE = 0.1 // charges within 10% of each other cluster together
const SUB_MIN_SPAN_DAYS = 20 // must span ~monthly, not two charges in one week

const UNUSUAL_LOOKBACK_DAYS = 7 // only flag recent expenses
const UNUSUAL_HISTORY_DAYS = 120
const UNUSUAL_MIN_SAMPLES = 4
const UNUSUAL_MULTIPLE = 3
const UNUSUAL_FLOOR_CENTS = 300_000 // KES 3,000 — don't flag small spikes

function categoryLabel(categoryId: string | null, names: Map<string, string>): string {
  if (categoryId === null) return 'Uncategorized'
  return names.get(categoryId) ?? 'Uncategorized'
}

function normalizeMerchant(merchant: string): string {
  return merchant.trim().toLowerCase()
}

function ordinal(day: number): string {
  const rem100 = day % 100
  if (rem100 >= 11 && rem100 <= 13) return `${day}th`
  switch (day % 10) {
    case 1:
      return `${day}st`
    case 2:
      return `${day}nd`
    case 3:
      return `${day}rd`
    default:
      return `${day}th`
  }
}

/** Median of a non-empty list; lower-middle for even counts (an actual sample). */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor((sorted.length - 1) / 2)
  return sorted[mid] ?? 0
}

/** category-pace: a category already past 80% of its usual monthly spend, ahead of schedule. */
function categoryPaceNudges(input: NudgeInputs): Nudge[] {
  const { transactions, categoryNameById, now, timeZone = NAIROBI_TZ } = input
  const keys = recentMonthKeys(now, PACE_BASELINE_MONTHS + 1, timeZone)
  const currentKey = keys[keys.length - 1]
  const baselineKeys = new Set(keys.slice(0, -1))
  if (!currentKey) return []

  const baselineByCategory = new Map<string | null, number>()
  const mtdByCategory = new Map<string | null, number>()

  for (const txn of transactions) {
    if (txn.kind !== 'expense') continue
    const key = nairobiMonthKey(txn.occurred_at, timeZone)
    const cat = txn.category_id ?? null
    if (key === currentKey) {
      mtdByCategory.set(cat, (mtdByCategory.get(cat) ?? 0) + txn.amount_cents)
    } else if (baselineKeys.has(key)) {
      baselineByCategory.set(cat, (baselineByCategory.get(cat) ?? 0) + txn.amount_cents)
    }
  }

  const dayOfMonth = Number(toNairobiDateString(now, timeZone).slice(8, 10))
  const daysInMonth = getDaysInMonth(new TZDate(now, timeZone))
  const elapsedFraction = dayOfMonth / daysInMonth

  const nudges: Nudge[] = []
  for (const [cat, baselineTotal] of baselineByCategory) {
    // Average across the full baseline window (zero months included) = "usual monthly".
    const usualMonthly = Math.round(baselineTotal / PACE_BASELINE_MONTHS)
    if (usualMonthly < PACE_MIN_BASELINE_CENTS) continue
    const mtd = mtdByCategory.get(cat) ?? 0
    const fraction = mtd / usualMonthly
    // Ahead of both the 80% mark AND the share of the month elapsed.
    if (fraction < PACE_TRIGGER_FRACTION || fraction <= elapsedFraction) continue

    const label = categoryLabel(cat, categoryNameById)
    nudges.push({
      signature: `pace:${cat ?? 'none'}:${currentKey}`,
      kind: 'category-pace',
      tone: 'warning',
      title: `${label} is running high`,
      body: `You've spent ${formatKES(mtd)} on ${label} this month — about ${Math.round(
        fraction * 100,
      )}% of your usual, and it's only the ${ordinal(dayOfMonth)}.`,
    })
  }
  // Worst-first, so the cap keeps the most meaningful one.
  return nudges.sort((a, b) => b.body.length - a.body.length)
}

/** subscription: a merchant charged ~the same amount ~monthly that isn't tracked as a bill. */
function subscriptionNudges(input: NudgeInputs): Nudge[] {
  const { transactions, recurringMerchants, now, timeZone = NAIROBI_TZ } = input
  const today = toNairobiDateString(now, timeZone)

  const byMerchant = new Map<string, { categoryId: string | null; amount: number; date: string }[]>()
  for (const txn of transactions) {
    if (txn.kind !== 'expense' || !txn.merchant) continue
    const date = toNairobiDateString(new Date(txn.occurred_at), timeZone)
    if (daysBetween(date, today) > SUB_WINDOW_DAYS) continue
    const norm = normalizeMerchant(txn.merchant)
    const list = byMerchant.get(norm) ?? []
    list.push({ categoryId: txn.category_id ?? null, amount: txn.amount_cents, date })
    byMerchant.set(norm, list)
  }

  const nudges: Nudge[] = []
  for (const [norm, charges] of byMerchant) {
    if (charges.length < SUB_MIN_OCCURRENCES) continue
    if (recurringMerchants.has(norm)) continue // already a tracked bill

    const amounts = charges.map((c) => c.amount)
    const min = Math.min(...amounts)
    const max = Math.max(...amounts)
    // Amounts must cluster (a real recurring charge, not scattered spend).
    if (max - min > max * SUB_AMOUNT_TOLERANCE) continue

    const dates = charges.map((c) => c.date).sort()
    const span = daysBetween(dates[0] ?? today, dates[dates.length - 1] ?? today)
    if (span < SUB_MIN_SPAN_DAYS) continue

    const representative = median(amounts)
    // Original-cased label from the first matching charge for nicer copy.
    const original = transactions.find((t) => t.merchant && normalizeMerchant(t.merchant) === norm)?.merchant ?? norm
    const categoryId = charges[0]?.categoryId ?? null

    nudges.push({
      signature: `sub:${norm}`,
      kind: 'subscription',
      tone: 'info',
      title: 'Looks like a subscription',
      body: `You've paid ${original} ${formatKES(representative)} about monthly. Track it as a bill so it's counted?`,
      action: { kind: 'add-recurring', merchant: original, amountCents: representative, categoryId },
    })
  }
  return nudges
}

/** unusual-spend: a recent expense far larger than the user's typical for its category. */
function unusualSpendNudges(input: NudgeInputs): Nudge[] {
  const { transactions, categoryNameById, now, timeZone = NAIROBI_TZ } = input
  const today = toNairobiDateString(now, timeZone)

  const expenses = transactions.filter((t) => t.kind === 'expense')

  const nudges: Nudge[] = []
  for (const txn of expenses) {
    const date = toNairobiDateString(new Date(txn.occurred_at), timeZone)
    if (daysBetween(date, today) > UNUSUAL_LOOKBACK_DAYS) continue
    if (txn.amount_cents < UNUSUAL_FLOOR_CENTS) continue

    const cat = txn.category_id ?? null
    const peers: number[] = []
    for (const other of expenses) {
      if (other.id === txn.id) continue
      if ((other.category_id ?? null) !== cat) continue
      const otherDate = toNairobiDateString(new Date(other.occurred_at), timeZone)
      if (daysBetween(otherDate, today) > UNUSUAL_HISTORY_DAYS) continue
      peers.push(other.amount_cents)
    }
    if (peers.length < UNUSUAL_MIN_SAMPLES) continue

    const typical = median(peers)
    if (typical <= 0 || txn.amount_cents < typical * UNUSUAL_MULTIPLE) continue

    const label = txn.merchant ?? categoryLabel(cat, categoryNameById)
    nudges.push({
      signature: `unusual:${txn.id}`,
      kind: 'unusual-spend',
      tone: 'info',
      title: 'Bigger than usual',
      body: `${formatKES(txn.amount_cents)} at ${label} is larger than your usual ${categoryLabel(
        cat,
        categoryNameById,
      )} spend.`,
    })
  }
  return nudges
}

/**
 * Compute all active nudges, ranked for display. Order: unusual spend (recent,
 * time-sensitive) → category pace (this month) → subscription suggestions
 * (informational). The surface caps how many it shows; dismissal is by
 * signature.
 */
export function computeNudges(input: NudgeInputs): Nudge[] {
  return [...unusualSpendNudges(input), ...categoryPaceNudges(input), ...subscriptionNudges(input)]
}
