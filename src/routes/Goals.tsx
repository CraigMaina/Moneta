import { useMemo, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Sheet } from '../components/ui/Sheet'
import { TabBar } from '../components/ui/TabBar'
import { GoalsIcon, PlusIcon } from '../components/ui/icons'
import { useToast } from '../components/ui/Toast'
import { AddTransactionSheet } from '../features/transactions/AddTransactionSheet'
import { Confetti } from '../features/goals/Confetti'
import { ContributeSheet } from '../features/goals/ContributeSheet'
import { GoalCard } from '../features/goals/GoalCard'
import { GoalEditorSheet } from '../features/goals/GoalEditorSheet'
import { goalSavedCents, projectGoalCompletion } from '../features/goals/goalMath'
import { useDeleteGoal } from '../features/goals/mutations'
import { useGoalContributions, useGoals } from '../features/goals/queries'
import type { Goal, GoalContribution } from '../features/goals/types'
import { useUiStore } from '../store/uiStore'

/**
 * Goals (PRD F7 / screen). A ring per goal with a first-class Contribute
 * action, a projected finish date from the trailing-30-day rate, and a
 * one-time celebration when a goal is reached. Contributions are tracked
 * earmarks (see DECISIONS.md) — they don't touch account balances.
 */
export function Goals() {
  const activeSheet = useUiStore((s) => s.activeSheet)
  const openSheet = useUiStore((s) => s.openSheet)
  const closeSheet = useUiStore((s) => s.closeSheet)
  const openAddSheet = () => openSheet('add')

  const { showToast } = useToast()
  const goalsQuery = useGoals()
  const contributionsQuery = useGoalContributions()
  const deleteGoal = useDeleteGoal()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null)
  const [celebrating, setCelebrating] = useState(false)

  const goals = goalsQuery.data ?? []
  const contributions = useMemo(() => contributionsQuery.data ?? [], [contributionsQuery.data])
  const contributionsByGoal = useMemo(() => {
    const map = new Map<string, GoalContribution[]>()
    for (const c of contributions) {
      const arr = map.get(c.goal_id) ?? []
      arr.push(c)
      map.set(c.goal_id, arr)
    }
    return map
  }, [contributions])

  const openCreate = () => {
    setEditingGoal(null)
    setEditorOpen(true)
  }
  const openEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setEditorOpen(true)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const goal = pendingDelete
    setPendingDelete(null)
    deleteGoal.mutate(goal.id, {
      onSuccess: () => showToast({ title: 'Goal deleted', description: goal.name, variant: 'info' }),
      onError: () => showToast({ title: "Couldn't delete that", variant: 'warn' }),
    })
  }

  const isLoading = goalsQuery.isPending || contributionsQuery.isPending
  const isError = goalsQuery.isError || contributionsQuery.isError

  return (
    <main className="min-h-dvh bg-paper-0 pb-28">
      <div className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+24px)]">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[22px] font-semibold text-ink-900">Goals</h1>
          {goals.length > 0 && (
            <Button variant="ghost" size="md" onClick={openCreate}>
              <PlusIcon className="h-5 w-5" />
              New
            </Button>
          )}
        </div>

        <div className="mt-5">
          {isLoading ? (
            <div className="space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-card bg-paper-50 motion-reduce:animate-none" aria-hidden="true" />
              ))}
            </div>
          ) : isError ? (
            <Card className="flex items-center justify-between gap-3">
              <p className="text-[15px] text-ink-600">Couldn&apos;t load your goals.</p>
              <Button
                variant="secondary"
                onClick={() => {
                  void goalsQuery.refetch()
                  void contributionsQuery.refetch()
                }}
              >
                Retry
              </Button>
            </Card>
          ) : goals.length === 0 ? (
            <Card className="p-0">
              <EmptyState
                icon={<GoalsIcon />}
                title="No goals yet"
                description="Set something to save for — a deposit, a trip, a rainy-day fund — and watch it fill up."
                actionLabel="Create a goal"
                onAction={openCreate}
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => {
                const goalContributions = contributionsByGoal.get(goal.id) ?? []
                const saved = goalSavedCents(goalContributions)
                return (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    savedCents={saved}
                    projection={projectGoalCompletion(saved, goal.target_cents, goalContributions)}
                    onContribute={() => setContributeGoal(goal)}
                    onEdit={() => openEdit(goal)}
                    onDelete={() => setPendingDelete(goal)}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      <TabBar onAddPress={openAddSheet} />
      <AddTransactionSheet open={activeSheet === 'add'} onClose={closeSheet} />

      <GoalEditorSheet open={editorOpen} onClose={() => setEditorOpen(false)} goal={editingGoal} />
      <ContributeSheet
        open={contributeGoal !== null}
        onClose={() => setContributeGoal(null)}
        goal={contributeGoal}
        onReached={() => {
          setContributeGoal(null)
          setCelebrating(true)
          showToast({ title: 'Goal reached 🎉', description: 'You did it.', variant: 'success' })
        }}
      />

      <Sheet open={pendingDelete !== null} onClose={() => setPendingDelete(null)} title="Delete goal?">
        {pendingDelete && (
          <div className="space-y-4">
            <p className="text-[15px] text-ink-600">
              This removes <span className="font-semibold text-ink-900">{pendingDelete.name}</span> and its saved history.
              This can&apos;t be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setPendingDelete(null)}>
                Keep it
              </Button>
              <Button variant="primary" fullWidth onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <Confetti show={celebrating} onDone={() => setCelebrating(false)} />
    </main>
  )
}
