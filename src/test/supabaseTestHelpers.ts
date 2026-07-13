/**
 * Shared, framework-agnostic fake for supabase-js's chainable query builder
 * (`PostgrestFilterBuilder`), used across feature-hook tests so none of them
 * need a live Supabase project or session (Phase 2 brief: "for TESTS, mock
 * the supabase client ... do not require a live session or network").
 *
 * supabase-js's builder is awaitable at any point in the chain (it resolves
 * to `{ data, error }`) and also exposes terminal `.single()`/`.maybeSingle()`
 * calls. `chainable()` fakes both: every intermediate method
 * (select/order/eq/gte/lte/limit/is/insert/update/delete/...) is recorded via
 * `onCall` and returns the same chainable value; awaiting it — directly, or
 * through `.single()`/`.maybeSingle()` — resolves to the configured result.
 */

export interface FakeQueryResult<T> {
  data: T
  error: { message: string } | null
}

export interface RecordedCall {
  method: string
  args: unknown[]
}

export function chainable<T>(
  result: FakeQueryResult<T>,
  onCall?: (call: RecordedCall) => void,
  /**
   * Optional artificial delay (ms) before the terminal promise settles, via
   * `setTimeout` rather than a plain microtask. Tests that need to inspect an
   * *optimistic* mutation state before its `mutationFn` settles (e.g. the
   * required "insert then rollback" test) pass a small delay so the fake
   * network response can't outrace `onMutate`'s own microtask chain
   * (`cancelQueries` etc.) — real Supabase calls always cross a macrotask
   * (the network), so this mirrors that rather than resolving instantly.
   */
  delayMs = 0,
): PromiseLike<FakeQueryResult<T>> {
  const settle = (resolve: (value: FakeQueryResult<T>) => void) => {
    if (delayMs > 0) {
      setTimeout(() => resolve(result), delayMs)
    } else {
      resolve(result)
    }
  }
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: FakeQueryResult<T>) => void) => settle(resolve)
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => new Promise<FakeQueryResult<T>>((resolve) => settle(resolve))
      }
      return (...args: unknown[]) => {
        onCall?.({ method: String(prop), args })
        return proxy
      }
    },
  }
  const proxy = new Proxy({}, handler) as PromiseLike<FakeQueryResult<T>>
  return proxy
}

/** Shorthand for a successful `{ data, error: null }` result. */
export function ok<T>(data: T): FakeQueryResult<T> {
  return { data, error: null }
}

/** Shorthand for a failed `{ data: null, error }` result. */
export function fail(message: string): FakeQueryResult<null> {
  return { data: null, error: { message } }
}

/** A fake `supabase.auth` with a resolved session for `userId` (or signed out if undefined). */
export function fakeAuthSession(userId: string | undefined) {
  const session = userId ? { user: { id: userId } } : null
  return {
    getSession: () => Promise.resolve({ data: { session }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  }
}
