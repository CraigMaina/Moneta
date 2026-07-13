import { useState, type ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Sheet } from '../components/ui/Sheet'
import { TabBar, type TabId } from '../components/ui/TabBar'
import { useToast } from '../components/ui/Toast'
import { EmptyState } from '../components/ui/EmptyState'
import { ReceiptIcon } from '../components/ui/icons'
import { formatKES } from '../lib/money'

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
