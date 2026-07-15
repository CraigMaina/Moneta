import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Keypad } from '../../components/ui/Keypad'
import { TrashIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import { formatKES, unitsToCents } from '../../lib/money'
import { useCreateGoal } from '../goals/mutations'
import { useCreateRecurringItem } from '../recurring/mutations'
import { StatementImportPanel } from '../import/StatementImportPanel'
import { toNairobiDateString } from '../transactions/nairobiDate'
import { useAccounts, useProfile } from '../transactions/queries'
import { useUpdateProfile, withOnboardingComplete } from './profileMutations'

/**
 * Onboarding (PRD F1: 90 seconds to value). A short, skippable flow that
 * collects the three inputs safe-to-spend needs to come alive — typical income,
 * fixed bills, one goal — then a statement backfill so the user starts already
 * up to date (real balances + safe-to-spend from day one). The scaffolding
 * (profile, accounts, categories) already exists from the `handle_new_user`
 * trigger, so this only COLLECTS and writes, then stamps the onboarding-complete
 * flag. Every step is skippable; skipped inputs just aren't written (the app
 * fills in sensible defaults and Home prompts to complete them later).
 */

type Step = 'welcome' | 'income' | 'bills' | 'goal' | 'statement'
const STEPS: Step[] = ['welcome', 'income', 'bills', 'goal', 'statement']

interface DraftBill {
  name: string
  amountCents: number
}

export function OnboardingFlow() {
  const { showToast } = useToast()
  const profileQuery = useProfile()
  const accountsQuery = useAccounts()
  const updateProfile = useUpdateProfile()
  const createRecurring = useCreateRecurringItem()
  const createGoal = useCreateGoal()

  const [stepIndex, setStepIndex] = useState(0)
  const [incomeCents, setIncomeCents] = useState(0)
  const [bills, setBills] = useState<DraftBill[]>([])
  const [goalName, setGoalName] = useState('')
  const [goalTargetCents, setGoalTargetCents] = useState(0)
  const [finishing, setFinishing] = useState(false)

  const step = STEPS[stepIndex] ?? 'welcome'
  const defaultAccountId = accountsQuery.data?.[0]?.id ?? null

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))

  /**
   * Persist whatever was collected and mark onboarding complete. Runs on
   * "Finish", on the paste step's close, and on "Skip for now". Best-effort per
   * write; the onboarding flag is the last and most important, and flipping it
   * re-renders the gate into the real app.
   */
  const finish = async () => {
    if (finishing) return
    setFinishing(true)
    try {
      for (const bill of bills) {
        if (bill.name.trim() && bill.amountCents > 0 && defaultAccountId) {
          await createRecurring
            .mutateAsync({
              kind: 'expense',
              amount_cents: bill.amountCents,
              account_id: defaultAccountId,
              merchant: bill.name.trim(),
              cadence: 'monthly',
              next_due_date: toNairobiDateString(new Date()),
            })
            .catch(() => undefined)
        }
      }
      if (goalName.trim() && goalTargetCents > 0) {
        await createGoal
          .mutateAsync({ name: goalName.trim(), target_cents: goalTargetCents, target_date: null, emoji: '🎯' })
          .catch(() => undefined)
      }
      await updateProfile.mutateAsync({
        ...(incomeCents > 0 ? { expected_income_cents: incomeCents } : {}),
        consent_flags: withOnboardingComplete(profileQuery.data),
      })
    } catch {
      showToast({ title: "Couldn't finish setup", description: 'You can complete it from Settings.', variant: 'warn' })
      setFinishing(false)
    }
    // On success the profile invalidation flips the gate; no need to reset state.
  }

  return (
    <main className="min-h-dvh bg-paper-0">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-[calc(env(safe-area-inset-top)+24px)] pb-8">
        <div className="flex items-center justify-between">
          <StepDots total={STEPS.length} current={stepIndex} />
          {step !== 'welcome' && (
            <button
              type="button"
              onClick={() => void finish()}
              className="text-[13px] font-semibold text-ink-600 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
            >
              Skip for now
            </button>
          )}
        </div>

        <div className="mt-8 flex-1">
          {step === 'welcome' && <WelcomeStep onStart={goNext} onSkip={() => void finish()} />}
          {step === 'income' && (
            <IncomeStep valueCents={incomeCents} onChange={setIncomeCents} onNext={goNext} finishing={finishing} />
          )}
          {step === 'bills' && (
            <BillsStep bills={bills} onChange={setBills} onNext={goNext} />
          )}
          {step === 'goal' && (
            <GoalStep
              name={goalName}
              onName={setGoalName}
              targetCents={goalTargetCents}
              onTarget={setGoalTargetCents}
              onNext={goNext}
            />
          )}
          {step === 'statement' && (
            <StatementStep onDone={() => void finish()} finishing={finishing} />
          )}
        </div>
      </div>
    </main>
  )
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn('h-1.5 rounded-full transition-all', i === current ? 'w-6 bg-coral-600' : 'w-1.5 bg-ink-300')}
        />
      ))}
    </div>
  )
}

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-[28px] font-semibold leading-tight text-ink-900">{title}</h1>
      {subtitle && <p className="mt-2 text-[15px] text-ink-600">{subtitle}</p>}
    </div>
  )
}

function WelcomeStep({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-[52px]" aria-hidden="true">
          👋
        </p>
        <h1 className="mt-4 font-display text-[32px] font-semibold leading-tight text-ink-900">
          Know what you can spend, every day.
        </h1>
        <p className="mt-3 text-[15px] text-ink-600">
          A quick setup: your income, a few regular bills, one thing you&apos;re saving for, and Moneta gives you a
          single safe-to-spend number.
        </p>
      </div>
      <div className="space-y-3">
        <Button fullWidth size="lg" onClick={onStart}>
          Get started
        </Button>
        <Button variant="ghost" fullWidth onClick={onSkip}>
          Skip for now
        </Button>
      </div>
    </div>
  )
}

function IncomeStep({
  valueCents,
  onChange,
  onNext,
  finishing,
}: {
  valueCents: number
  onChange: (cents: number) => void
  onNext: () => void
  finishing: boolean
}) {
  return (
    <div className="flex h-full flex-col">
      <StepHeading title="Your typical monthly income" subtitle="Roughly what lands each month. You can change it anytime." />
      <div className="flex-1">
        <Keypad valueCents={valueCents} onChange={onChange} />
      </div>
      <Button fullWidth size="lg" onClick={onNext} disabled={finishing}>
        {valueCents > 0 ? 'Continue' : 'Skip this'}
      </Button>
    </div>
  )
}

function BillsStep({
  bills,
  onChange,
  onNext,
}: {
  bills: DraftBill[]
  onChange: (bills: DraftBill[]) => void
  onNext: () => void
}) {
  const [name, setName] = useState('')
  const [amountUnits, setAmountUnits] = useState('')

  const addBill = () => {
    const amountCents = unitsToCents(Number(amountUnits))
    if (!name.trim() || !Number.isFinite(amountCents) || amountCents <= 0) return
    onChange([...bills, { name: name.trim(), amountCents }])
    setName('')
    setAmountUnits('')
  }

  return (
    <div className="flex h-full flex-col">
      <StepHeading title="Any regular bills?" subtitle="Rent, subscriptions, a Sacco standing order. These keep your number honest." />

      {bills.length > 0 && (
        <ul className="mb-4 space-y-2">
          {bills.map((bill, i) => (
            <li key={i} className="flex items-center justify-between gap-3 rounded-card bg-paper-50 px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink-900">{bill.name}</span>
              <span className="text-[15px] font-semibold tabular-nums text-ink-900">{formatKES(bill.amountCents)}</span>
              <button
                type="button"
                aria-label={`Remove ${bill.name}`}
                onClick={() => onChange(bills.filter((_, j) => j !== i))}
                className="text-ink-600 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex-1 space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bill name (e.g. Rent)"
          aria-label="Bill name"
          className="h-12 w-full rounded-card bg-paper-50 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        />
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={amountUnits}
            onChange={(e) => setAmountUnits(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Amount (KES)"
            aria-label="Bill amount in KES"
            className="h-12 flex-1 rounded-card bg-paper-50 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
          />
          <Button variant="secondary" onClick={addBill} disabled={!name.trim() || !amountUnits}>
            Add
          </Button>
        </div>
      </div>

      <Button fullWidth size="lg" onClick={onNext}>
        {bills.length > 0 ? 'Continue' : 'Skip this'}
      </Button>
    </div>
  )
}

function GoalStep({
  name,
  onName,
  targetCents,
  onTarget,
  onNext,
}: {
  name: string
  onName: (v: string) => void
  targetCents: number
  onTarget: (cents: number) => void
  onNext: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <StepHeading title="One thing to save for" subtitle="A deposit, a trip, a rainy-day fund. Just one to start." />
      <input
        type="text"
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="e.g. Emergency fund"
        aria-label="Goal name"
        className="mb-4 h-12 w-full rounded-card bg-paper-50 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
      />
      <div className="flex-1">
        <Keypad valueCents={targetCents} onChange={onTarget} />
      </div>
      <Button fullWidth size="lg" onClick={onNext}>
        {name.trim() && targetCents > 0 ? 'Continue' : 'Skip this'}
      </Button>
    </div>
  )
}

function StatementStep({ onDone, finishing }: { onDone: () => void; finishing: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <StepHeading
        title="Start already up to date"
        subtitle="Paste your M-PESA statement to bring in your recent transactions, so Moneta opens with your real balances and safe-to-spend. Optional; you can also do this later in Settings."
      />
      <div className="flex-1">
        <StatementImportPanel importLabel="Import & finish" onImported={onDone} />
      </div>
      <Button variant="ghost" fullWidth onClick={onDone} loading={finishing} className="mt-4">
        Skip for now
      </Button>
    </div>
  )
}
