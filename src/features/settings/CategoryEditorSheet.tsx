import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import type { Category } from '../transactions/types'
import type { Database } from '../../lib/database.types'
import { EmojiPicker } from './EmojiPicker'
import { isDuplicateNameError, useCreateCategory, useUpdateCategory } from './mutations'

type CategoryKind = Database['public']['Enums']['category_kind']

/**
 * Add or edit a category (PRD §7). Kind (spend vs income) is chosen on create
 * and fixed thereafter — it decides which section the category lives in and
 * which transactions can use it, so flipping it on an in-use category would be
 * a footgun. No `<form>` inside the sheet (CLAUDE.md).
 */
export interface CategoryEditorSheetProps {
  open: boolean
  onClose: () => void
  /** Present = edit; absent/null = create. */
  category?: Category | null
  /** Pre-selects the kind when creating from a specific section. */
  defaultKind?: CategoryKind
}

export function CategoryEditorSheet({ open, onClose, category, defaultKind = 'expense' }: CategoryEditorSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={category ? 'Edit category' : 'New category'}>
      {/* Fresh mount per open → useState seeds from props with no effect. */}
      {open && <CategoryEditorBody category={category} defaultKind={defaultKind} onClose={onClose} />}
    </Sheet>
  )
}

function CategoryEditorBody({
  category,
  defaultKind,
  onClose,
}: {
  category?: Category | null
  defaultKind: CategoryKind
  onClose: () => void
}) {
  const { showToast } = useToast()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const isEdit = Boolean(category)

  const [name, setName] = useState(category?.name ?? '')
  const [kind, setKind] = useState<CategoryKind>((category?.kind as CategoryKind | undefined) ?? defaultKind)
  const [icon, setIcon] = useState<string | null>(category?.icon ?? null)

  const saving = createCategory.isPending || updateCategory.isPending
  const canSave = name.trim().length > 0 && !saving

  const handleSave = () => {
    if (!canSave) return
    const onError = (error: unknown) =>
      showToast({
        title: isDuplicateNameError(error) ? 'You already have a category with that name' : "Couldn't save that",
        variant: 'warn',
      })

    if (category) {
      updateCategory.mutate(
        { id: category.id, patch: { name: name.trim(), icon } },
        {
          onSuccess: () => {
            showToast({ title: 'Saved', variant: 'success' })
            onClose()
          },
          onError,
        },
      )
    } else {
      createCategory.mutate(
        { name: name.trim(), kind, icon },
        {
          onSuccess: () => {
            showToast({ title: 'Category added', variant: 'success' })
            onClose()
          },
          onError,
        },
      )
    }
  }

  return (
    <div className="space-y-5">
      <label className="block space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chama, School fees, Side hustle"
          aria-label="Category name"
          className="h-12 w-full rounded-card bg-paper-0 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        />
      </label>

      {!isEdit && (
        <div className="space-y-2">
          <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Type</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(['expense', 'income'] as CategoryKind[]).map((option) => {
              const active = kind === option
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKind(option)}
                  className={cn(
                    'flex h-11 items-center justify-center rounded-card text-[14px] font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600',
                    active ? 'bg-coral-100 text-coral-600 ring-1 ring-coral-600' : 'bg-paper-0 text-ink-600',
                  )}
                >
                  {option === 'expense' ? 'Spending' : 'Income'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Icon (optional)</span>
        <EmojiPicker value={icon} onChange={setIcon} />
      </div>

      <Button fullWidth size="lg" onClick={handleSave} loading={saving} disabled={!canSave}>
        {isEdit ? 'Save changes' : 'Add category'}
      </Button>
    </div>
  )
}
