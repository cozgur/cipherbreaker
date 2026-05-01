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

  it('builds 9000 4-digit candidates for the non-unique pool (no leading zero — SPEC §3)', () => {
    const pool = buildAllCandidates(false);
    expect(pool).toHaveLength(9_000);
    expect(pool[0]).toBe('1000');
    expect(pool[pool.length - 1]).toBe('9999');
    // No leading-zero candidates survive.
    for (const candidate of pool) {
      expect(candidate[0]).not.toBe('0');
    }
  });

  it('builds 4536 4-digit candidates for the all-unique pool (no leading zero — SPEC §3)', () => {
    const pool = buildAllCandidates(true);
    // 10·9·8·7 − 9·8·7 = 5040 − 504 = 4536
    expect(pool).toHaveLength(4_536);
    for (const candidate of pool) {
      expect(new Set(candidate).size).toBe(4);
      expect(candidate[0]).not.toBe('0');
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
