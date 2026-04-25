/**
 * Async micro-helpers shared by the heavy-filtering path. Kept
 * separate from `candidatePool.ts` so unit tests can stub
 * `yieldToUI` cheaply without pulling in the whole pool builder.
 */

/**
 * Hand the JS thread back to the runtime so layout, frame, and input
 * events can flush. Used between candidate-pool chunks (Mode 3, Mode
 * 5) so a 5040-permutation filter doesn't drop frames.
 *
 * `setTimeout(0)` (not `queueMicrotask` or `Promise.resolve()`) is
 * intentional: microtasks would run *before* the next render, so the
 * UI thread would still be blocked. A macrotask hop yields all the
 * way out to the event loop.
 */
export function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
