/**
 * Pure swipe-commit decision for a transaction row's Framer Motion `drag="x"`
 * gesture — mirrors `Sheet.tsx`'s `shouldDismissSheetDrag` pattern exactly: a
 * pure, unit-testable threshold instead of asserting on a simulated pointer
 * gesture (jsdom has no real drag geometry, so this is what's actually
 * tested; the component wires it to `onDragEnd`).
 *
 * Swipe left commits "delete"; swipe right commits "recategorize". The
 * offset/velocity thresholds are the same magnitude as `Sheet`'s own
 * drag-to-dismiss constants — not CLAUDE.md tokens, just a deliberately
 * reused "intentional gesture, not an accidental wobble" feel. See
 * DECISIONS.md.
 */

export type RowSwipeAction = 'delete' | 'recategorize'

const SWIPE_COMMIT_OFFSET_PX = 96
const SWIPE_COMMIT_VELOCITY_PX_PER_S = 500

export function resolveRowSwipeAction(offsetX: number, velocityX: number): RowSwipeAction | null {
  const pastLeft = offsetX < -SWIPE_COMMIT_OFFSET_PX || velocityX < -SWIPE_COMMIT_VELOCITY_PX_PER_S
  const pastRight = offsetX > SWIPE_COMMIT_OFFSET_PX || velocityX > SWIPE_COMMIT_VELOCITY_PX_PER_S

  if (pastLeft && !pastRight) return 'delete'
  if (pastRight && !pastLeft) return 'recategorize'
  return null
}
