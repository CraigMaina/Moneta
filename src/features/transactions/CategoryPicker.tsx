import { useMemo, useState } from 'react'
import { CategoryChip } from '../../components/ui/CategoryChip'
import { Sheet } from '../../components/ui/Sheet'
import { ChevronDownIcon } from '../../components/ui/icons'
import { categoryIcon } from './iconMaps'
import type { Category } from './types'

/**
 * A category picker (PRD §4.3, "most-used first"): shows a handful of categories
 * inline and, when there are more, a "+N more" button that opens a popup with
 * the full set — so a user with many custom categories isn't faced with a wall
 * of chips or made to scroll sideways to reach one. The selected category is
 * always kept in the inline window (pulled to the front), so the current choice
 * never hides behind the popup.
 */

const COLLAPSED_COUNT = 6

export interface CategoryPickerProps {
  categories: Pick<Category, 'id' | 'name' | 'icon'>[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CategoryPicker({ categories, selectedId, onSelect }: CategoryPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  // Keep the selected chip in the collapsed window: order it (and the first
  // few) to the front so it's visible without opening the popup.
  const ordered = useMemo(() => {
    if (!selectedId) return categories
    const selected = categories.find((c) => c.id === selectedId)
    if (!selected) return categories
    return [selected, ...categories.filter((c) => c.id !== selectedId)]
  }, [categories, selectedId])

  const overflow = ordered.length > COLLAPSED_COUNT
  const visible = overflow ? ordered.slice(0, COLLAPSED_COUNT) : ordered

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {visible.map((category) => (
          <CategoryChip
            key={category.id}
            icon={categoryIcon(category)}
            label={category.name}
            selected={selectedId === category.id}
            onSelect={() => onSelect(category.id)}
          />
        ))}
        {overflow && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex h-11 flex-shrink-0 items-center gap-1 rounded-full bg-paper-50 px-4 text-[15px] font-semibold text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0"
          >
            +{ordered.length - COLLAPSED_COUNT} more
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Choose a category">
        <div className="flex flex-wrap gap-2 pb-2">
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              icon={categoryIcon(category)}
              label={category.name}
              selected={selectedId === category.id}
              onSelect={() => {
                onSelect(category.id)
                setPickerOpen(false)
              }}
            />
          ))}
        </div>
      </Sheet>
    </>
  )
}
