import { useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PencilIcon, PlusIcon, TrashIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/Toast'
import { categoryIcon } from '../transactions/iconMaps'
import { useCategories } from '../transactions/queries'
import type { Category } from '../transactions/types'
import type { Database } from '../../lib/database.types'
import { CategoryEditorSheet } from './CategoryEditorSheet'
import { ManagerSkeleton } from './ManagerSkeleton'
import { useArchiveCategory, useRestoreCategory } from './mutations'

type CategoryKind = Database['public']['Enums']['category_kind']

/**
 * Manage categories (PRD §7): add your own, rename/re-icon, or remove. Grouped
 * by kind (Spending / Income). "Remove" archives with Undo; transactions
 * already filed under a removed category keep it (they just stop appearing in
 * pickers).
 */
export function CategoryManager() {
  const { showToast } = useToast()
  const categoriesQuery = useCategories()
  const archiveCategory = useArchiveCategory()
  const restoreCategory = useRestoreCategory()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [createKind, setCreateKind] = useState<CategoryKind>('expense')

  const { expense, income } = useMemo(() => {
    const all = categoriesQuery.data ?? []
    return {
      expense: all.filter((c) => c.kind === 'expense'),
      income: all.filter((c) => c.kind === 'income'),
    }
  }, [categoriesQuery.data])

  const openCreate = (kind: CategoryKind) => {
    setEditing(null)
    setCreateKind(kind)
    setEditorOpen(true)
  }
  const openEdit = (category: Category) => {
    setEditing(category)
    setEditorOpen(true)
  }

  const handleRemove = (category: Category) => {
    archiveCategory.mutate(category.id, {
      onError: () => showToast({ title: "Couldn't remove that", variant: 'warn' }),
    })
    showToast({
      title: 'Removed',
      description: category.name,
      variant: 'info',
      action: {
        label: 'Undo',
        onClick: () =>
          restoreCategory.mutate(category.id, {
            onError: () => showToast({ title: "Couldn't undo that", variant: 'warn' }),
          }),
      },
    })
  }

  return (
    <>
      {categoriesQuery.isPending ? (
        <Card className="p-0">
          <ManagerSkeleton />
        </Card>
      ) : categoriesQuery.isError ? (
        <Card className="flex items-center justify-between gap-3">
          <p className="text-[15px] text-ink-600">Couldn&apos;t load your categories.</p>
          <Button variant="secondary" onClick={() => void categoriesQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : (
        <div className="space-y-5">
          <CategorySection
            heading="Spending"
            categories={expense}
            onAdd={() => openCreate('expense')}
            onEdit={openEdit}
            onRemove={handleRemove}
          />
          <CategorySection
            heading="Income"
            categories={income}
            onAdd={() => openCreate('income')}
            onEdit={openEdit}
            onRemove={handleRemove}
          />
        </div>
      )}

      <CategoryEditorSheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        category={editing}
        defaultKind={createKind}
      />
    </>
  )
}

function CategorySection({
  heading,
  categories,
  onAdd,
  onEdit,
  onRemove,
}: {
  heading: string
  categories: Category[]
  onAdd: () => void
  onEdit: (c: Category) => void
  onRemove: (c: Category) => void
}) {
  return (
    <div>
      <h3 className="mb-2 px-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">{heading}</h3>
      <Card className="p-0">
        {categories.length > 0 && (
          <ul className="divide-y divide-ink-300/40">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-paper-50 text-ink-900">
                  {categoryIcon(category)}
                </span>
                <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink-900">{category.name}</p>
                <button
                  type="button"
                  aria-label={`Edit ${category.name}`}
                  onClick={() => onEdit(category)}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${category.name}`}
                  onClick={() => onRemove(category)}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center gap-2 px-4 py-3.5 text-[15px] font-semibold text-coral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        >
          <PlusIcon className="h-5 w-5" />
          Add {heading.toLowerCase()} category
        </button>
      </Card>
    </div>
  )
}
