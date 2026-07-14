import { useState, type ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Sheet } from '../components/ui/Sheet'
import { TabBar, type TabId } from '../components/ui/TabBar'
import { useToast } from '../components/ui/Toast'
import { EmptyState } from '../components/ui/EmptyState'
import { AmountDisplay } from '../components/ui/AmountDisplay'
import { Keypad } from '../components/ui/Keypad'
import { CategoryChip } from '../components/ui/CategoryChip'
import { ProgressRing } from '../components/ui/ProgressRing'
import { SafeToSpendHero } from '../components/ui/SafeToSpendHero'
import {
  AirtimeIcon,
  EatingOutIcon,
  EntertainmentIcon,
  GroceriesIcon,
  HomeIcon,
  OtherIcon,
  ReceiptIcon,
  ShoppingIcon,
  TransportIcon,
} from '../components/ui/icons'
import { formatKES } from '../lib/money'
import { ParseConfirmationCard, type AccountOption } from '../features/parser/ParseConfirmationCard'
import { ParseTransform } from '../features/parser/ParseTransform'
import { PasteToParse, type PasteToParseStatus } from '../features/parser/PasteToParse'
import type { ParsedMpesaMessage } from '../parser/types'

/**
 * `/kitchen-sink` — the visual QA surface for every design-system primitive,
 * in every state, at 390x844. Not linked from the tab bar; direct-URL only.
 */
export function KitchenSink() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  const handleSimulateLoading = () => {
    setDemoLoading(true)
    setTimeout(() => setDemoLoading(false), 1800)
  }

  return (
    <main className="min-h-dvh bg-paper-0 pb-32">
      <div className="mx-auto max-w-md px-4 pt-8">
        <h1 className="font-display text-[32px] font-semibold tracking-tight text-ink-900">Kitchen sink</h1>
        <p className="mt-1 text-[15px] text-ink-600">
          Every primitive, every state. Direct-URL only — not in the tab bar.
        </p>

        <ButtonSection demoLoading={demoLoading} onSimulateLoading={handleSimulateLoading} />
        <CardSection />
        <SheetSection open={sheetOpen} onOpen={() => setSheetOpen(true)} onClose={() => setSheetOpen(false)} />
        <ToastSection />
        <EmptyStateSection />
        <AmountDisplaySection />
        <KeypadSection />
        <CategoryChipSection />
        <ProgressRingSection />
        <SafeToSpendHeroSection />
        <ParserSection />
        <TabBarSection onAddPress={() => setSheetOpen(true)} />
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-8">
      <h2 className="font-display text-[22px] font-semibold text-ink-900">{title}</h2>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">{children}</p>
}

function ButtonSection({ demoLoading, onSimulateLoading }: { demoLoading: boolean; onSimulateLoading: () => void }) {
  return (
    <Section title="Button">
      <div>
        <Label>Variants</Label>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <p className="mt-2 text-[12.5px] text-ink-600">
          No destructive variant — CLAUDE.md has no danger/error token distinct from coral (the primary-action
          color). See DECISIONS.md.
        </p>
      </div>

      <div>
        <Label>Sizes</Label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </div>

      <div>
        <Label>States</Label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button>Default</Button>
          <Button disabled>Disabled</Button>
          <Button loading={demoLoading} onClick={onSimulateLoading}>
            {demoLoading ? 'Saving' : 'Simulate loading'}
          </Button>
        </div>
      </div>

      <div>
        <Label>Full width</Label>
        <Button fullWidth className="mt-2">
          Continue
        </Button>
      </div>
    </Section>
  )
}

function CardSection() {
  const { showToast } = useToast()
  return (
    <Section title="Card">
      <div>
        <Label>Default</Label>
        <Card className="mt-2">
          <p className="text-[15px] font-semibold text-ink-900">Rent</p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums text-ink-900">{formatKES(3500000)}</p>
        </Card>
      </div>
      <div>
        <Label>Interactive (press me)</Label>
        <Card
          interactive
          className="mt-2"
          onClick={() => showToast({ title: 'Card pressed', description: 'Rent goal', variant: 'info' })}
        >
          <p className="text-[15px] font-semibold text-ink-900">Groceries</p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums text-ink-900">{formatKES(1200000)}</p>
        </Card>
      </div>
    </Section>
  )
}

function SheetSection({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  return (
    <Section title="Sheet">
      <Button onClick={onOpen}>Open sheet</Button>
      <Sheet open={open} onClose={onClose} title="Add expense">
        <p className="text-[15px] text-ink-600">
          Drag down, tap outside, or press Escape to dismiss. No <code>&lt;form&gt;</code> here — buttons + handlers
          only.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onClose} className="flex-1">
            Log it
          </Button>
        </div>
      </Sheet>
    </Section>
  )
}

function ToastSection() {
  const { showToast } = useToast()
  return (
    <Section title="Toast">
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() => showToast({ title: 'Marked paid', description: 'Rent for July', variant: 'success' })}
        >
          Success
        </Button>
        <Button
          variant="secondary"
          onClick={() => showToast({ title: 'Synced', description: 'Transactions are up to date', variant: 'info' })}
        >
          Info
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            showToast({ title: 'Close to your limit', description: "You've used 80% of Food this month", variant: 'warn' })
          }
        >
          Warn
        </Button>
      </div>
    </Section>
  )
}

function EmptyStateSection() {
  return (
    <Section title="EmptyState">
      <Card className="p-0">
        <EmptyState
          icon={<ReceiptIcon />}
          title="No transactions yet"
          description="Paste an M-PESA message or log one manually to see it here."
          actionLabel="Add a transaction"
          onAction={() => {}}
        />
      </Card>
    </Section>
  )
}

function AmountDisplaySection() {
  return (
    <Section title="AmountDisplay">
      <div>
        <Label>Sizes</Label>
        <div className="mt-2 space-y-2">
          <AmountDisplay cents={145000} size="hero" />
          <AmountDisplay cents={145000} size="title" />
          <AmountDisplay cents={145000} size="body" />
        </div>
      </div>
      <div>
        <Label>Tones</Label>
        <div className="mt-2 space-y-2">
          <AmountDisplay cents={50000} size="body" tone="income" signed />
          <AmountDisplay cents={-32000} size="body" tone="expense" signed />
          <AmountDisplay cents={128000} size="body" tone="warning" />
        </div>
        <p className="mt-2 text-[12.5px] text-ink-600">
          Expenses stay in ink-900 (calm, not alarming) — warning (amber-600) is reserved for actual warning contexts,
          not routine spend. See DECISIONS.md.
        </p>
      </div>
    </Section>
  )
}

function KeypadSection() {
  const [cents, setCents] = useState(0)
  return (
    <Section title="Keypad">
      <div>
        <Label>Live — running value it produces</Label>
        <Card className="mt-2">
          <Keypad onChange={setCents} />
        </Card>
        <p className="mt-2 text-[12.5px] text-ink-600">
          Committed value via <code>formatKES</code>: <AmountDisplay cents={cents} size="body" className="inline" />
        </p>
      </div>
    </Section>
  )
}

const DEMO_CATEGORIES = [
  { id: 'groceries', label: 'Groceries', icon: <GroceriesIcon /> },
  { id: 'eating-out', label: 'Eating Out', icon: <EatingOutIcon /> },
  { id: 'transport', label: 'Transport', icon: <TransportIcon /> },
  { id: 'rent', label: 'Rent & Utilities', icon: <HomeIcon /> },
  { id: 'airtime', label: 'Airtime & Data', icon: <AirtimeIcon /> },
  { id: 'shopping', label: 'Shopping', icon: <ShoppingIcon /> },
  { id: 'entertainment', label: 'Entertainment', icon: <EntertainmentIcon /> },
  { id: 'other', label: 'Other', icon: <OtherIcon /> },
]

function CategoryChipSection() {
  const [selected, setSelected] = useState('groceries')
  return (
    <Section title="CategoryChip">
      <div>
        <Label>Horizontal scroller — most-used first</Label>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {DEMO_CATEGORIES.map((category) => (
            <CategoryChip
              key={category.id}
              icon={category.icon}
              label={category.label}
              selected={selected === category.id}
              onSelect={() => setSelected(category.id)}
            />
          ))}
        </div>
      </div>
    </Section>
  )
}

function ProgressRingSection() {
  return (
    <Section title="ProgressRing">
      <div>
        <Label>0 / 25 / 60 / 100%</Label>
        <div className="mt-2 flex flex-wrap items-center gap-6">
          {[0, 0.25, 0.6, 1].map((progress) => (
            <ProgressRing key={progress} progress={progress} size={72} strokeWidth={8} label={`${Math.round(progress * 100)} percent`}>
              <span className="text-[12.5px] font-semibold tabular-nums text-ink-900">{Math.round(progress * 100)}%</span>
            </ProgressRing>
          ))}
        </div>
      </div>
    </Section>
  )
}

function SafeToSpendHeroSection() {
  return (
    <Section title="SafeToSpendHero">
      <div>
        <Label>Healthy — positive, mid-range</Label>
        <Card className="mt-2 flex justify-center py-8">
          <SafeToSpendHero safeToSpendCents={140000} spentTodayCents={20000} dailyBudgetCents={50000} />
        </Card>
      </div>
      <div>
        <Label>Near-zero — still positive, low daily allowance left</Label>
        <Card className="mt-2 flex justify-center py-8">
          <SafeToSpendHero safeToSpendCents={150} spentTodayCents={48000} dailyBudgetCents={50000} />
        </Card>
      </div>
      <div>
        <Label>Negative — over this month, calm amber, no shame</Label>
        <Card className="mt-2 flex justify-center py-8">
          <SafeToSpendHero safeToSpendCents={-34000} spentTodayCents={50000} dailyBudgetCents={50000} />
        </Card>
      </div>
      <p className="text-[12.5px] text-ink-600">
        Reduced motion (OS setting) skips the count-up and the arc&apos;s breathing pulse on all three states above.
      </p>
    </Section>
  )
}

const GALLERY_TABS: TabId[] = ['home', 'transactions', 'goals', 'insights']

function TabBarSection({ onAddPress }: { onAddPress: () => void }) {
  return (
    <Section title="TabBar">
      <div>
        <Label>Static gallery — one active state per row</Label>
        <div className="mt-2 space-y-3">
          {GALLERY_TABS.map((tab) => (
            <div key={tab}>
              <p className="mb-1 text-[12.5px] capitalize text-ink-600">{tab} active</p>
              <TabBar onAddPress={() => {}} activeOverride={tab} position="static" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label>Live instance (fixed, bottom of viewport, real routes)</Label>
        <p className="mt-1 text-[12.5px] text-ink-600">
          The Add button opens the Sheet demo above. Navigating a tab leaves this page — re-enter the URL to come
          back.
        </p>
      </div>
      <TabBar onAddPress={onAddPress} />
    </Section>
  )
}

/*
 * Parse-confirmation gallery (Phase 3, design-engineer). Self-contained demo
 * data below — deliberately NOT imported from `src/parser/__fixtures__`
 * (test-only fixtures), so this gallery stays independent of the parser's
 * own test corpus. Every ParseConfirmationCard/ParseTransform/PasteToParse
 * prop here is a callback — no data hooks, matching how the lead will
 * compose them into the real Add sheet.
 */

const PARSER_DEMO_ACCOUNTS: AccountOption[] = [
  { id: 'demo-mpesa', name: 'M-PESA', type: 'mpesa' },
  { id: 'demo-cash', name: 'Cash', type: 'cash' },
]

const DEMO_EXPENSE_WITH_CATEGORY: ParsedMpesaMessage = {
  amountCents: 10000,
  kind: 'expense',
  feeCents: 0,
  merchant: null,
  accountReference: null,
  mpesaRef: 'AIR1DEMO01',
  occurredAt: '2026-07-16T15:00:00.000Z',
  newBalanceCents: 40000,
  category: 'Airtime & Data',
  family: 'airtime',
  counterAccountHint: null,
  transferDirection: null,
  reversalOfRef: null,
  rawText: 'AIR1DEMO01 Confirmed. You bought Ksh100.00 of airtime on 16/7/26 at 6:00 PM. New M-PESA balance is Ksh400.00.',
  patternId: 'airtime-v1',
  parserVersion: 'pattern-2026.07',
}

const DEMO_EXPENSE_NULL_CATEGORY: ParsedMpesaMessage = {
  amountCents: 150000,
  kind: 'expense',
  feeCents: 1500,
  merchant: 'KENYA POWER AND LIGHTING CO',
  accountReference: '12345678',
  mpesaRef: 'PBL1DEMO01',
  occurredAt: '2026-07-09T07:15:00.000Z',
  newBalanceCents: 200000,
  category: null,
  family: 'paybill',
  counterAccountHint: null,
  transferDirection: null,
  reversalOfRef: null,
  rawText:
    'PBL1DEMO01 Confirmed. Ksh1,500.00 paid to KENYA POWER AND LIGHTING CO for account 12345678 on 9/7/26 at 10:15 AM. New M-PESA balance is Ksh2,000.00. Transaction cost, Ksh15.00.',
  patternId: 'paybill-v1',
  parserVersion: 'pattern-2026.07',
}

const DEMO_WITHDRAWAL: ParsedMpesaMessage = {
  amountCents: 200000,
  kind: 'transfer',
  feeCents: 2800,
  merchant: '123456 - JOHN AGENT SHOP',
  accountReference: null,
  mpesaRef: 'WDL1DEMO01',
  occurredAt: '2026-07-11T08:00:00.000Z',
  newBalanceCents: 50000,
  category: null,
  family: 'withdrawal',
  counterAccountHint: 'cash',
  transferDirection: 'mpesa_to_counter',
  reversalOfRef: null,
  rawText:
    'WDL1DEMO01 Confirmed. You have withdrawn Ksh2,000.00 from agent 123456 - JOHN AGENT SHOP on 11/7/26 at 11:00 AM. New M-PESA balance is Ksh500.00. Transaction cost, Ksh28.00.',
  patternId: 'withdrawal-v1',
  parserVersion: 'pattern-2026.07',
}

function ParserSection() {
  const { showToast } = useToast()
  const [transformParsed, setTransformParsed] = useState(false)
  const [pasteStatus, setPasteStatus] = useState<PasteToParseStatus>('idle')

  return (
    <Section title="Parser: parse-confirmation">
      <div>
        <Label>Card — expense, categorized, with a "Sync balance" affordance</Label>
        <ParseConfirmationCard
          className="mt-2"
          parsed={DEMO_EXPENSE_WITH_CATEGORY}
          accounts={PARSER_DEMO_ACCOUNTS}
          onConfirm={() => showToast({ title: 'Logged', variant: 'success' })}
          onEditCategory={() => showToast({ title: 'Opens the category picker', variant: 'info' })}
          onSyncBalance={() => showToast({ title: 'Balance synced', variant: 'success' })}
          onCancel={() => showToast({ title: 'Cancelled', variant: 'info' })}
        />
      </div>

      <div>
        <Label>Card — null category shows the "Pick a category" prompt</Label>
        <ParseConfirmationCard
          className="mt-2"
          parsed={DEMO_EXPENSE_NULL_CATEGORY}
          accounts={PARSER_DEMO_ACCOUNTS}
          onConfirm={() => {}}
          onEditCategory={() => showToast({ title: 'Opens the category picker', variant: 'info' })}
          onCancel={() => {}}
        />
      </div>

      <div>
        <Label>Card — withdrawal: transfer + a separate fee line, never a single expense</Label>
        <ParseConfirmationCard
          className="mt-2"
          parsed={DEMO_WITHDRAWAL}
          accounts={PARSER_DEMO_ACCOUNTS}
          onConfirm={() => {}}
          onEditCategory={() => {}}
          onCancel={() => {}}
        />
      </div>

      <div>
        <Label>Card — saving (disabled, loading "Log it")</Label>
        <ParseConfirmationCard
          className="mt-2"
          parsed={DEMO_EXPENSE_WITH_CATEGORY}
          accounts={PARSER_DEMO_ACCOUNTS}
          onConfirm={() => {}}
          onEditCategory={() => {}}
          onCancel={() => {}}
          saving
        />
      </div>

      <div>
        <Label>ParseTransform — the raw SMS -&gt; card wow moment</Label>
        <div className="mt-2 rounded-card bg-paper-50 p-3">
          <ParseTransform rawText={DEMO_EXPENSE_WITH_CATEGORY.rawText} parsed={transformParsed}>
            <ParseConfirmationCard
              parsed={DEMO_EXPENSE_WITH_CATEGORY}
              accounts={PARSER_DEMO_ACCOUNTS}
              onConfirm={() => {}}
              onEditCategory={() => {}}
              onCancel={() => {}}
            />
          </ParseTransform>
        </div>
        <Button variant="secondary" className="mt-2" onClick={() => setTransformParsed((v) => !v)}>
          {transformParsed ? 'Show raw message again' : 'Replay the transform'}
        </Button>
        <p className="mt-2 text-[12.5px] text-ink-600">
          Reduced motion (OS setting) swaps stages instantly, with no dissolve/spring.
        </p>
      </div>

      <div>
        <Label>PasteToParse — idle / pending / unparseable fallback</Label>
        <Card className="mt-2 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="md" onClick={() => setPasteStatus('idle')}>
              Idle
            </Button>
            <Button variant="secondary" size="md" onClick={() => setPasteStatus('pending')}>
              Pending
            </Button>
            <Button variant="secondary" size="md" onClick={() => setPasteStatus('error')}>
              Unparseable
            </Button>
          </div>
          <PasteToParse
            status={pasteStatus}
            onParse={() => setPasteStatus('pending')}
            onEnterManually={() => showToast({ title: 'Opens manual entry', variant: 'info' })}
          />
        </Card>
      </div>
    </Section>
  )
}
