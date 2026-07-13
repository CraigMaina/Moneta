/**
 * Tiny className joiner. Filters falsy values so conditional Tailwind classes
 * read cleanly (`cn('base', active && 'active-class')`).
 *
 * Not `clsx`/`tailwind-merge` — this app's className usage never needs
 * conflict-resolution (last-wins) merging, just falsy filtering, so a tiny
 * local helper avoids adding a dependency for something this small.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
