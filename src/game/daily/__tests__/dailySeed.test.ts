import { getDailySecret } from '../dailySeed';

describe('getDailySecret — global determinism', () => {
  it('returns the same secret for the same (date, digits) pair across calls', () => {
    expect(getDailySecret('2026-05-01', 4)).toBe(getDailySecret('2026-05-01', 4));
    expect(getDailySecret('2027-01-15', 5)).toBe(getDailySecret('2027-01-15', 5));
  });

  it('returns different secrets for different dates at the same digit count', () => {
    const a = getDailySecret('2026-05-01', 4);
    const b = getDailySecret('2026-05-02', 4);
    expect(a).not.toBe(b);
  });

  it('returns different secrets for the same date at different digit counts', () => {
    const a = getDailySecret('2026-05-01', 4);
    const b = getDailySecret('2026-05-01', 5);
    expect(a).not.toBe(b);
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(5);
  });
});

describe('getDailySecret — SPEC § invariants', () => {
  it.each([3, 4, 5, 6, 7, 8])('produces a string of length %i', (length) => {
    const secret = getDailySecret('2026-05-01', length);
    expect(secret).toHaveLength(length);
    expect(secret).toMatch(/^\d+$/);
  });

  it.each(['2026-05-01', '2026-05-02', '2026-05-03', '2026-12-31', '2027-06-15'])(
    'first digit is never 0 (SPEC §3 invariant) — date %s',
    (date) => {
      for (const length of [4, 5, 6]) {
        const secret = getDailySecret(date, length);
        expect(secret[0]).not.toBe('0');
      }
    },
  );

  it('eventually produces multiset (digit-repeating) secrets across the calendar', () => {
    // Daily's distinguishing property vs Mode 3 is that the secret
    // pool allows repeats. Sweep 200 days at length 4; at least one
    // must be non-unique (probability of pure-unique 200 days in a
    // row at this digit count is vanishingly small).
    let foundRepeat = false;
    for (let i = 0; i < 200; i += 1) {
      const date = `2026-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
      const secret = getDailySecret(date, 4);
      if (new Set(secret).size < 4) {
        foundRepeat = true;
        break;
      }
    }
    expect(foundRepeat).toBe(true);
  });
});

describe('getDailySecret — input validation', () => {
  it('rejects non-positive digit counts', () => {
    expect(() => getDailySecret('2026-05-01', 0)).toThrow(RangeError);
    expect(() => getDailySecret('2026-05-01', -1)).toThrow(RangeError);
  });

  it('rejects fractional digit counts', () => {
    expect(() => getDailySecret('2026-05-01', 4.5)).toThrow(RangeError);
  });
});
