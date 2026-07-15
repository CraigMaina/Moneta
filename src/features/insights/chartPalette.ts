/**
 * A fixed 6-colour chart ramp for the category donut/legend. CLAUDE.md's
 * palette deliberately has no per-category hue token (see the CategoryChip
 * decision), but a donut needs several *distinguishable* colours at once —
 * so this is a small, documented exception (recorded in DECISIONS.md). The
 * hues are mid-saturation on purpose: each reads legibly on both the warm
 * white (`--paper-0` light) and the near-black (`--paper-0` dark) surface, so
 * one ramp serves both themes without a second dark set. The coral head colour
 * matches the brand so the largest slice ties back to the app's accent.
 */
export const CHART_PALETTE = [
  '#e8474b', // coral (brand)
  '#e0a044', // amber
  '#2fa06a', // leaf
  '#5b8def', // blue
  '#b06fd6', // violet
  '#8a8285', // warm grey (tail / Other)
] as const

export function chartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length] ?? CHART_PALETTE[0]
}
