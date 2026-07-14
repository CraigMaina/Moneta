import { useMemo, useState } from 'react'
import { CategoryChip } from '../../components/ui/CategoryChip'
import { ChevronDownIcon } from '../../components/ui/icons'
import { cn } from '../../lib/cn'
import { categoryIcon } from './iconMaps'
import type { Category } from './types'

/**
 * A collapsible category picker (PRD §4.3, "most-used first"): shows a handful
 * of categories by default and expands to the full set on demand — so a user
 * with many custom categories isn't faced with a wall of chips, but nothing is
 * ever out of reach. The currently-selected category is always kept visible in
 * the collapsed view (it's pulled into the first slots), so the selection never
 * hides behind "Show all".
 */

const COLLAPSED_COUNT = 6

export interface CategoryPickerProps {
  categories: Pick<Category, 'id' | 'name' | 'icon'>[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CategoryPicker({ categories, selectedId, onSelect }: CategoryPickerProps) {
  const [expanded, setExpanded] = useState(false)

  // Keep the selected chip in the collapsed window: order it (and the first
  // few) to the front so it's visible without expanding.
  const ordered = useMemo(() => {
    if (!selectedId) return categories
    const selected = categories.find((c) => c.id === selectedId)
    if (!selected) return categories
    return [selected, ...categories.filter((c) => c.id !== selectedId)]
  }, [categories, selectedId])

  const overflow = ordered.length > COLLAPSED_COUNT
  const visible = expanded || !overflow ? ordered : ordered.slice(0, COLLAPSED_COUNT)

  return (
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
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex h-11 flex-shrink-0 items-center gap-1 rounded-full bg-paper-50 px-4 text-[15px] font-semibold text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0"
        >
          {expanded ? 'Less' : `+${ordered.length - COLLAPSED_COUNT} more`}
          <ChevronDownIcon className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}
