/**
 * Web Share Target (PRD §F3) — the pure part.
 *
 * The manifest registers Moneta as an Android **GET** share target: sharing an
 * SMS from the Messages app opens the app at `/?title=…&text=…&url=…`. Home
 * reads those params, folds them into the shared SMS text, opens the
 * paste-parse flow, then strips the params from the URL. A GET target keeps
 * this to plain query-string parsing — no service-worker POST interception
 * needed (M-PESA SMS are short, well within URL limits). This helper is that
 * params → SMS-text mapping, factored out to be unit-testable.
 */

export interface SharedContent {
  title?: string | null
  text?: string | null
  url?: string | null
}

/**
 * The shared SMS text to hand the parser. An M-PESA SMS shared from Messages
 * lands in `text`; some apps also attach a `url`. `title` is only a last
 * resort. Returns `null` when nothing usable was shared.
 */
export function extractSharedText(shared: SharedContent): string | null {
  const parts = [shared.text, shared.url].map((part) => (part ?? '').trim()).filter(Boolean)
  const combined = (parts.join(' ') || (shared.title ?? '').trim()).trim()
  return combined || null
}
