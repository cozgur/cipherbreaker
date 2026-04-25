import {
  __resetCandidatePoolCacheForTests,
  buildAllCandidates,
  filterByFeedback,
  filterByFeedbackChunked,
} from '../candidatePool';

describe('candidatePool', () => {
  beforeEach(() => {
    __resetCandidatePoolCacheForTests();
  });

  it('builds 10000 4-digit candidates for the non-unique pool', () => {
    const pool = buildAllCandidates(false);
    expect(pool).toHaveLength(10_000);
    expect(pool[0]).toBe('0000');
    expect(pool[pool.length - 1]).toBe('9999');
  });

  it('builds 5040 4-digit candidates for the all-unique pool', () => {
    const pool = buildAllCandidates(true);
    // 10 * 9 * 8 * 7 = 5040
    expect(pool).toHaveLength(5_040);
    for (const candidate of pool) {
      expect(new Set(candidate).size).toBe(4);
    }
  });

  it('returns the same array reference on repeated calls (module cache)', () => {
    const a = buildAllCandidates(false);
    const b = buildAllCandidates(false);
    expect(a).toBe(b);
  });

  it('filterByFeedback returns a fresh filtered array (sync)', () => {
    const pool = ['1234', '1243', '4321', '5678'];
    const filtered = filterByFeedback(pool, (c) => c.startsWith('12'));
    expect(filtered).toEqual(['1234', '1243']);
    expect(filtered).not.toBe(pool);
  });

  it('filterByFeedbackChunked yields the same result as the sync filter', async () => {
    const pool = buildAllCandidates(true);
    const evaluator = (c: string) => c.startsWith('12');
    const sync = filterByFeedback(pool, evaluator);
    const chunked = await filterByFeedbackChunked(pool, evaluator, 500);
    expect(chunked).toEqual(sync);
  });

  it('filterByFeedbackChunked respects a custom chunkSize', async () => {
    const pool = ['0001', '0002', '0003', '0004', '0005'];
    const out = await filterByFeedbackChunked(pool, () => true, 2);
    expect(out).toEqual(pool);
  });

  it('filterByFeedbackChunked rejects non-positive chunkSize', async () => {
    await expect(filterByFeedbackChunked(['0000'], () => true, 0)).rejects.toThrow(RangeError);
    await expect(filterByFeedbackChunked(['0000'], () => true, -3)).rejects.toThrow(RangeError);
  });
});
