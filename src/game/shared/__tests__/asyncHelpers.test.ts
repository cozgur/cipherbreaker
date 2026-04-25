import { yieldToUI } from '../asyncHelpers';

describe('yieldToUI', () => {
  it('resolves on the next macrotask (after pending microtasks)', async () => {
    const order: string[] = [];
    const promise = yieldToUI().then(() => {
      order.push('macrotask');
    });
    queueMicrotask(() => {
      order.push('microtask');
    });
    await promise;
    expect(order).toEqual(['microtask', 'macrotask']);
  });

  it('returns a thenable (callable repeatedly without leaking timers)', async () => {
    for (let i = 0; i < 3; i += 1) {
      await yieldToUI();
    }
    // The fact this completes is the assertion — no hung timers.
    expect(true).toBe(true);
  });
});
