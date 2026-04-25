/**
 * Test-only persistence helpers. `waitForHydration` resolves once
 * Zustand's `onFinishHydration` has fired for a given store — the
 * persist middleware's hydration is async, so any test that asserts
 * post-clear state must wait for the storage round-trip to settle
 * before running. Without this guard a fast test can race the
 * hydrate callback and observe stale state.
 *
 * Liveloop guard: stores without persist middleware are detected
 * via the `persist` field check; callers can safely pass any store.
 */

interface PersistedStoreLike {
  readonly persist?: {
    hasHydrated(): boolean;
    onFinishHydration(callback: () => void): () => void;
  };
}

export async function waitForHydration(store: PersistedStoreLike): Promise<void> {
  if (store.persist === undefined) return;
  if (store.persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsubscribe = store.persist!.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}
