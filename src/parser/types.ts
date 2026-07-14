import { z } from 'zod'

/**
 * Moneta M-PESA parser — output contract.
 *
 * This is the single contract other agents build against: the backend Edge
 * Function (LLM fallback, `parse-sms`) must resolve to the same shape after
 * its own zod validation, and the design layer's parse-confirmation card
 * renders straight off these fields. Keep it stable; extend, don't reshape.
 *
 * ── Money & date rules baked into this contract (CLAUDE.md) ──────────────
 *  - `amountCents`/`feeCents`/`newBalanceCents` are always integer cents.
 *    Never floats, never string math. See `money.ts`.
 *  - Amounts are always positive; direction lives entirely in `kind`.
 *  - `occurredAt` is a correct ISO *instant*, computed from the SMS's
 *    Africa/Nairobi wall-clock date/time (`timestamp.ts`), never the
 *    device's local zone.
 *
 * ── Category names ────────────────────────────────────────────────────────
 * `category` is a stable category *name* (not an id) drawn verbatim from the
 * PRD §4.3 seeded default set (see `categoryNameSchema` below), so the
 * integrator's name → category_id lookup is a trivial join against the
 * user's `categories` table. `null` means "no confident guess" — never a
 * wrong guess (same "never guess" discipline as the LLM-fallback path).
 *
 * ── THE HARD CASE: how to turn one ParsedMpesaMessage into 1–2 rows ───────
 *
 * `kind` is one of `income | expense | transfer` (CLAUDE.md: transfers are
 * never income/expense). Every family maps to a well-defined row plan:
 *
 * 1. **received** (money received from a person) — `kind: 'income'`.
 *    → ONE income row. `feeCents` is always 0 for this family (Safaricom
 *    doesn't charge the receiver).
 *
 * 2. **sent_to_person** — `kind: 'expense'`.
 *    → ONE expense row for `amountCents`. If `feeCents > 0`, ALSO create a
 *    second expense row for `feeCents` in category **"Fees & Fuliza
 *    charges"** (see the generic fee rule below).
 *
 * 3. **paybill** / **buy_goods** / **pochi_la_biashara** — `kind: 'expense'`.
 *    → Same shape as (2): one expense row for `amountCents`, plus a fee row
 *    if `feeCents > 0`. `accountReference` (paybill account number, when
 *    present) has no dedicated transactions column — append it to the row's
 *    `note`, e.g. `"Acc: 12345678"`.
 *
 * 4. **airtime** — `kind: 'expense'`, `category: 'Airtime & Data'`.
 *    → ONE expense row. No fee (Safaricom doesn't charge for airtime top-up).
 *
 * 5. **withdrawal** (agent withdrawal) — `kind: 'transfer'`,
 *    `counterAccountHint: 'cash'`, `transferDirection: 'mpesa_to_counter'`.
 *    → THIS IS THE HARD CASE (CLAUDE.md money rule 3 / PRD §4.2): a
 *    withdrawal is a **transfer plus a separate fee expense**, never a
 *    single expense. The integrator must create:
 *      a) a `transfer` row moving `amountCents` from the user's M-PESA
 *         account to their Cash account (`account_id` = M-PESA,
 *         `counter_account_id` = Cash, per `transferDirection`), and
 *      b) IF `feeCents > 0`, a SECOND row: `kind: 'expense'`,
 *         `amount_cents: feeCents`, `category: 'Fees & Fuliza charges'`,
 *         account = M-PESA (the fee is debited from M-PESA, not Cash).
 *    Both rows share one parse event but need two DISTINCT `mpesa_ref`
 *    values for the DB's per-user-unique `mpesa_ref` index — recommend
 *    `mpesaRef` for the transfer row and `` `${mpesaRef}-FEE` `` for the fee
 *    row (dedupe-safe: re-parsing the same SMS reproduces the same two refs
 *    and both upserts become no-ops).
 *
 * 6. **deposit** (agent deposit) — `kind: 'transfer'`,
 *    `counterAccountHint: 'cash'`, `transferDirection: 'counter_to_mpesa'`.
 *    → ONE transfer row, Cash → M-PESA. Deposits carry no fee in practice
 *    (`feeCents` is 0) but the generic fee rule still applies if a future
 *    format ever includes one.
 *
 * 7. **fuliza_drawdown** — `kind: 'transfer'`, `counterAccountHint: 'bank'`
 *    (Fuliza is a Safaricom/KCB-underwritten overdraft facility; v1's
 *    3-account model — M-PESA/Cash/Bank — has no dedicated liability
 *    account, so it's bucketed under "bank" as the closest fit; see
 *    DECISIONS.md), `transferDirection: 'mpesa_to_counter'` is WRONG
 *    direction-wise for a drawdown — drawdown money flows INTO M-PESA
 *    (borrowed funds fund your spend), so this family always sets
 *    `transferDirection: 'counter_to_mpesa'`.
 *    → ONE transfer row (excluded from all P&L totals — "Fuliza drawdown is
 *    not income" is enforced structurally by `kind`, not by convention).
 *    IF `feeCents > 0` (the Fuliza access fee, when the message includes
 *    it), ALSO create a fee expense row exactly per the withdrawal rule
 *    above, category **"Fees & Fuliza charges"**, ref `` `${mpesaRef}-FEE` ``.
 *
 * 8. **fuliza_repayment** — `kind: 'transfer'`, `counterAccountHint: 'bank'`,
 *    `transferDirection: 'mpesa_to_counter'` (M-PESA balance pays down the
 *    Fuliza liability).
 *    → ONE transfer row. No P&L impact (paying down a loan isn't a new
 *    expense; the spend was already excluded at drawdown time, above).
 *
 * 9. **mshwari_kcb_transfer** (M-Shwari / KCB M-PESA moves, either
 *    direction) — `kind: 'transfer'`, `counterAccountHint: 'bank'`
 *    (same 3-account-model bucketing rationale as Fuliza; see
 *    DECISIONS.md), `transferDirection` set per the message's own wording
 *    (`'mpesa_to_counter'` for "to M-Shwari/KCB", `'counter_to_mpesa'` for
 *    "from M-Shwari/KCB").
 *    → ONE transfer row.
 *
 * 10. **reversal** — `kind: 'transfer'` used here ONLY as a safety marker
 *     meaning "never book this as a plain income/expense" — a reversal has
 *     no real second account, so `counterAccountHint`/`transferDirection`
 *     are BOTH `null` for this family alone (the schema's invariant that
 *     `kind: 'transfer'` requires both is relaxed specifically for
 *     `family: 'reversal'`; see the `superRefine` below).
 *     `reversalOfRef` carries the ORIGINAL transaction's `mpesa_ref`.
 *     → The integrator's real action is keyed off `reversalOfRef`, not
 *     `kind`:
 *       a) Look up the existing transaction where `mpesa_ref ===
 *          reversalOfRef`.
 *       b) If found: negate it — delete it, or insert an equal-and-opposite
 *          entry tagged as a reversal — so it nets to zero in every total
 *          ("the number never lies", PRD §4.5/§10). Record the reversal
 *          message's own `mpesaRef` (if present) as an audit note on that
 *          transaction; do NOT insert it as its own income/expense row.
 *       c) If NOT found (e.g. the original predates the app, or was a
 *          statement-import row that hasn't landed yet): this is a rare
 *          edge case — route it to manual-entry review rather than
 *          silently guessing a `kind` for it, exactly like an LLM-fallback
 *          validation failure would be handled.
 *
 * The one rule that spans every family with `feeCents > 0` (withdrawal,
 * paybill/buy_goods/sent_to_person with a transaction cost, Fuliza
 * drawdown): the fee is ALWAYS its own expense row in category "Fees &
 * Fuliza charges", debited from M-PESA, dated `occurredAt`, never merged
 * into the primary row's `amountCents`.
 */

/** PRD §4.3 seeded default category names — the parser only ever suggests one of these (or `null`). */
export const CATEGORY_NAMES = [
  // Income
  'Salary',
  'Business',
  'Gig/Freelance',
  'Gift/Received',
  'Other income',
  // Expense
  'Food & Groceries',
  'Eating Out',
  'Transport',
  'Rent & Utilities',
  'Airtime & Data',
  'Shopping',
  'Health',
  'Education',
  'Family & Black Tax',
  'Chama & Savings-out',
  'Entertainment',
  'Subscriptions',
  'Fees & Fuliza charges',
  'Giving/Tithe',
  'Other',
] as const

export const INCOME_CATEGORY_NAMES: ReadonlySet<string> = new Set([
  'Salary',
  'Business',
  'Gig/Freelance',
  'Gift/Received',
  'Other income',
])

export const categoryNameSchema = z.enum(CATEGORY_NAMES)
export type CategoryName = z.infer<typeof categoryNameSchema>

/** Every known M-PESA SMS format family (PRD §F2). Order in `patterns.json` is separate from this list. */
export const MPESA_FAMILIES = [
  'received',
  'sent_to_person',
  'paybill',
  'buy_goods',
  'pochi_la_biashara',
  'withdrawal',
  'deposit',
  'airtime',
  'fuliza_drawdown',
  'fuliza_repayment',
  'mshwari_kcb_transfer',
  'reversal',
] as const

export const mpesaFamilySchema = z.enum(MPESA_FAMILIES)
export type MpesaFamily = z.infer<typeof mpesaFamilySchema>

export const transactionKindSchema = z.enum(['income', 'expense', 'transfer'])
export type TransactionKind = z.infer<typeof transactionKindSchema>

/**
 * The account type on the OTHER side of a transfer, from M-PESA's
 * perspective (every message this parser reads is an M-PESA SMS, so M-PESA
 * is always one leg). `'mpesa'` is reserved for forward-compatibility with a
 * future non-M-PESA-sourced message (e.g. a bank SMS parser) and is never
 * emitted by the current pattern table.
 */
export const counterAccountHintSchema = z.enum(['cash', 'mpesa', 'bank']).nullable()
export type CounterAccountHint = z.infer<typeof counterAccountHintSchema>

/**
 * Which way money moved for a transfer family. `'mpesa_to_counter'` = money
 * left M-PESA (withdrawal, Fuliza repayment, "to M-Shwari");
 * `'counter_to_mpesa'` = money entered M-PESA (deposit, Fuliza drawdown,
 * "from M-Shwari").
 */
export const transferDirectionSchema = z.enum(['mpesa_to_counter', 'counter_to_mpesa']).nullable()
export type TransferDirection = z.infer<typeof transferDirectionSchema>

const isoInstantSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'occurredAt must be a valid ISO date/time string')

const trimmedNonEmpty = z.string().trim().min(1)

export const parsedMpesaMessageSchema = z
  .object({
    /** Always positive; direction lives in `kind`. */
    amountCents: z.number().int('amountCents must be an integer').positive('amountCents must be > 0'),
    kind: transactionKindSchema,
    /** Integer cents, >= 0. 0 means "no fee mentioned in this message." */
    feeCents: z.number().int('feeCents must be an integer').nonnegative('feeCents must be >= 0'),
    /** Counterparty / business / agent name, human-presentable (not merchant-memory-normalized — call `normalizeMerchant` for that). */
    merchant: trimmedNonEmpty.nullable(),
    /** PayBill account number / reference, when the family carries one (paybill only; null otherwise). */
    accountReference: trimmedNonEmpty.nullable(),
    /** The M-PESA transaction code — the dedupe backbone (PRD §F2, CLAUDE.md). */
    mpesaRef: trimmedNonEmpty,
    /** Correct ISO instant, computed in Africa/Nairobi from the SMS's date/time. */
    occurredAt: isoInstantSchema,
    /** "New M-PESA balance is Ksh..." when present, else null (drives the balance-reconciliation prompt). */
    newBalanceCents: z.number().int().nonnegative().nullable(),
    /** A stable PRD §4.3 category name, or null when there's no confident guess. */
    category: categoryNameSchema.nullable(),
    family: mpesaFamilySchema,
    counterAccountHint: counterAccountHintSchema,
    transferDirection: transferDirectionSchema,
    /** Reversal only: the ORIGINAL transaction's mpesa_ref being negated. Null for every other family. */
    reversalOfRef: trimmedNonEmpty.nullable(),
    /** The raw SMS text, verbatim (post-trim). Stored only per the user's raw-SMS consent flag (F11). */
    rawText: trimmedNonEmpty,
    /** Which `patterns.json` entry matched (provenance / debugging / "author a fixture from this miss"). */
    patternId: trimmedNonEmpty,
    /** `patterns.json`'s `version` at parse time, e.g. `"pattern-2026.07"`. */
    parserVersion: trimmedNonEmpty,
  })
  .superRefine((val, ctx) => {
    if (val.kind === 'transfer') {
      // Reversal is the one transfer-kind family with no real second account
      // (see the big doc comment above) — exempt it from the hint/direction
      // requirement that every other transfer family must satisfy.
      if (val.family !== 'reversal') {
        if (val.counterAccountHint === null) {
          ctx.addIssue({ code: 'custom', message: 'transfers require counterAccountHint', path: ['counterAccountHint'] })
        }
        if (val.transferDirection === null) {
          ctx.addIssue({ code: 'custom', message: 'transfers require transferDirection', path: ['transferDirection'] })
        }
      }
      if (val.category !== null) {
        ctx.addIssue({ code: 'custom', message: 'transfers must not have a category', path: ['category'] })
      }
    } else {
      if (val.counterAccountHint !== null) {
        ctx.addIssue({
          code: 'custom',
          message: 'only transfers may set counterAccountHint',
          path: ['counterAccountHint'],
        })
      }
      if (val.transferDirection !== null) {
        ctx.addIssue({
          code: 'custom',
          message: 'only transfers may set transferDirection',
          path: ['transferDirection'],
        })
      }
      if (val.category !== null) {
        const isIncomeCategory = INCOME_CATEGORY_NAMES.has(val.category)
        if ((val.kind === 'income') !== isIncomeCategory) {
          ctx.addIssue({
            code: 'custom',
            message: `category "${val.category}" does not match kind "${val.kind}"`,
            path: ['category'],
          })
        }
      }
    }

    if (val.family === 'reversal' && val.reversalOfRef === null) {
      ctx.addIssue({ code: 'custom', message: 'reversal messages require reversalOfRef', path: ['reversalOfRef'] })
    }
    if (val.family !== 'reversal' && val.reversalOfRef !== null) {
      ctx.addIssue({ code: 'custom', message: 'only reversal messages set reversalOfRef', path: ['reversalOfRef'] })
    }
  })

export type ParsedMpesaMessage = z.infer<typeof parsedMpesaMessageSchema>

export type ParseResult = { status: 'matched'; data: ParsedMpesaMessage } | { status: 'unmatched'; raw: string }
