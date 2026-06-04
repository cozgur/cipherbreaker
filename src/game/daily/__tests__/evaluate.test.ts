/**
 * Multiset +N / -M evaluator — Phase 7A.4 CP2 test-first suite.
 *
 * Test cases written BEFORE the implementation per the advisor
 * discipline ("verify, not trust"). The five edge cases below were
 * hand-computed by the advisor; they are the contract the
 * implementation must satisfy. The hane-agnostic and Mode-3-parity
 * sweeps are regression scaffolding around that contract.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { evaluateColorMatch } from '../../modes/mode1/evaluate';
import { evaluatePrecision } from '../../modes/mode3/evaluate';
import { colorMatchStates, evaluateDailyGuess } from '../evaluate';

describe('evaluateDailyGuess — multiset edge cases (advisor hand-computed)', () => {
  it("a) secret '1233' + guess '3213' → +2 -2 (advisor reference re-derived)", () => {
    // Advisor's original hand-trace claimed +1 -2, but the trace
    // contained an arithmetic slip (asserted "pos 2 hit, 3==3" when
    // secret[2]='3' but guess[2]='1'). The actual positional matches
    // are at pos 1 ('2'='2') and pos 3 ('3'='3') → plus=2; pass 2
    // claims g[0]='3' against s[2] and g[2]='1' against s[0] →
    // minus=2. Mode 3's algorithm (copied verbatim modulo the length
    // constant) yields the same +2 -2 here.
    const r = evaluateDailyGuess('3213', '1233');
    expect(r).toMatchObject({ kind: 'precision', plus: 2, minus: 2, isWin: false });
  });

  it("b) secret '1111' + guess '2222' → +0 -0", () => {
    const r = evaluateDailyGuess('2222', '1111');
    expect(r).toMatchObject({ kind: 'precision', plus: 0, minus: 0, isWin: false });
  });

  it("c) secret '1234' + guess '4321' → +0 -4", () => {
    const r = evaluateDailyGuess('4321', '1234');
    expect(r).toMatchObject({ kind: 'precision', plus: 0, minus: 4, isWin: false });
  });

  it("d) secret '0000' + guess '0000' → +4 -0 (full multiset match)", () => {
    const r = evaluateDailyGuess('0000', '0000');
    expect(r).toMatchObject({ kind: 'precision', plus: 4, minus: 0, isWin: true });
  });

  it("e) secret '1212' + guess '1221' → +2 -2", () => {
    const r = evaluateDailyGuess('1221', '1212');
    expect(r).toMatchObject({ kind: 'precision', plus: 2, minus: 2, isWin: false });
  });
});

describe('evaluateDailyGuess — multiset hidden traps (no double-count)', () => {
  // The `used[]` ledger must prevent a single secret slot from being
  // claimed by two different guess digits. These cases would slip
  // past a naive "for each guess digit, scan secret for membership"
  // implementation.

  it("secret '1234' + guess '1111' → +1 -0 (only one '1' in secret can be claimed)", () => {
    const r = evaluateDailyGuess('1111', '1234');
    expect(r).toMatchObject({ plus: 1, minus: 0 });
  });

  it("secret '1111' + guess '1234' → +1 -0 (only one '1' in guess can claim a slot)", () => {
    const r = evaluateDailyGuess('1234', '1111');
    expect(r).toMatchObject({ plus: 1, minus: 0 });
  });

  it("secret '1233' + guess '3321' → trace it explicitly", () => {
    // Pass 1: pos0 '3' vs '1' (no), pos1 '3' vs '2' (no),
    //         pos2 '2' vs '3' (no), pos3 '1' vs '3' (no) → plus=0
    // Pass 2:
    //   guess[0]='3': secret has '3' at indices 2,3 (none used) →
    //     minus=1, used[2]=T
    //   guess[1]='3': secret[3]='3' unused → minus=2, used[3]=T
    //   guess[2]='2': secret[1]='2' unused → minus=3, used[1]=T
    //   guess[3]='1': secret[0]='1' unused → minus=4, used[0]=T
    // Result: +0 -4
    const r = evaluateDailyGuess('3321', '1233');
    expect(r).toMatchObject({ plus: 0, minus: 4 });
  });
});

describe('evaluateDailyGuess — length-agnostic sweep (Daily 4 / 5 / 6 + headroom)', () => {
  it.each([
    [3, '123'],
    [4, '1234'],
    [5, '12345'],
    [6, '123456'],
    [7, '1234567'],
    [8, '12345678'],
  ])('isWin=true at length %i when guess === secret', (length, sample) => {
    const r = evaluateDailyGuess(sample, sample);
    if (r.kind !== 'precision') throw new Error(`expected precision feedback, got ${r.kind}`);
    expect(r.plus).toBe(length);
    expect(r.minus).toBe(0);
    expect(r.isWin).toBe(true);
  });

  it.each([3, 4, 5, 6, 7, 8])(
    'plus + minus never exceeds the secret length (length %i)',
    (length) => {
      // Construct a fresh pair where guess is the secret rotated by
      // one — every digit in guess appears in secret, but at a
      // different position → all minus.
      const secret = Array.from({ length }, (_, i) => String((i + 1) % 10)).join('');
      const guess = secret.slice(1) + secret[0];
      const r = evaluateDailyGuess(guess, secret);
      if (r.kind !== 'precision') throw new Error(`expected precision feedback, got ${r.kind}`);
      expect(r.plus + r.minus).toBeLessThanOrEqual(length);
    },
  );
});

describe('evaluateDailyGuess — Mode 3 parity (unique inputs produce identical NormalizedFeedback)', () => {
  // Daily multiset evaluator and Mode 3 unique-only evaluator must
  // agree byte-for-byte on every input where neither secret nor
  // guess has repeated digits — the multiset path simply doesn't
  // exercise the new behaviour. Confirms the Daily port is
  // Mode-3-equivalent on Mode-3-shaped inputs (algorithm identity).
  it.each([
    ['1234', '1234'],
    ['1234', '1243'],
    ['1234', '4321'],
    ['1234', '5678'],
    ['1234', '1567'],
    ['9876', '6789'],
    ['1023', '2031'],
  ])('Mode 3 vs Daily on unique pair (secret=%s, guess=%s)', (secret, guess) => {
    const daily = evaluateDailyGuess(guess, secret);
    const mode3 = evaluatePrecision(guess, secret);
    expect(daily).toEqual(mode3);
  });
});

describe('colorMatchStates — Phase 7A.8 CP9 (Mode 1 Daily days)', () => {
  it('matches the SPEC §3.2 worked example: secret=1122, guess=1919 → green,gray,yellow,gray', () => {
    expect(colorMatchStates('1919', '1122')).toEqual(['green', 'gray', 'yellow', 'gray']);
  });

  it('paints every position green on an exact match', () => {
    expect(colorMatchStates('1234', '1234')).toEqual(['green', 'green', 'green', 'green']);
  });

  it('used[] ledger prevents duplicate over-claiming: secret=1122, guess=1111 → green,green,gray,gray', () => {
    // Only two '1's exist in the secret; pos 0 takes the green, pos 1
    // takes the other '1' as green, the remaining two '1's find no
    // unconsumed slot → gray (not yellow).
    expect(colorMatchStates('1111', '1122')).toEqual(['green', 'green', 'gray', 'gray']);
  });

  it('parity with the production length-4 evaluateColorMatch on unique + multiset pairs', () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ['1919', '1122'],
      ['1234', '4321'],
      ['5678', '1234'],
      ['1111', '1122'],
      ['1221', '1212'],
      ['0000', '0000'],
    ];
    for (const [guess, secret] of pairs) {
      const fb = evaluateColorMatch(guess, secret);
      if (fb.kind !== 'colorMatch') throw new Error(`expected colorMatch, got ${fb.kind}`);
      expect(colorMatchStates(guess, secret)).toEqual(fb.states);
    }
  });

  it('is length-generic across the Daily 4 / 5 / 6 tiers', () => {
    expect(colorMatchStates('12345', '12345')).toHaveLength(5);
    expect(colorMatchStates('123456', '123456')).toHaveLength(6);
    expect(colorMatchStates('123456', '123456').every((s) => s === 'green')).toBe(true);
  });

  it('agrees with evaluateDailyGuess on the win condition (all green ⟺ plus === length)', () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ['1234', '1234'],
      ['1243', '1234'],
      ['122122', '122122'],
    ];
    for (const [guess, secret] of pairs) {
      const allGreen = colorMatchStates(guess, secret).every((s) => s === 'green');
      const precision = evaluateDailyGuess(guess, secret);
      if (precision.kind !== 'precision') throw new Error('expected precision');
      expect(allGreen).toBe(precision.isWin);
    }
  });
});

describe('evaluateDailyGuess — purity invariants', () => {
  // The evaluator must remain a pure function (engine boundary —
  // SPEC §3.4). A future "let me touch React state inside the
  // evaluator" PR fails here loudly.
  it('source file does not import React or React Native', () => {
    const path = join(__dirname, '..', 'evaluate.ts');
    const src = readFileSync(path, 'utf8');
    expect(src).not.toMatch(/from\s+['"]react['"]/);
    expect(src).not.toMatch(/from\s+['"]react-native['"]/);
  });

  it('returns the same NormalizedFeedback for the same inputs (idempotent across calls)', () => {
    const a = evaluateDailyGuess('3213', '1233');
    const b = evaluateDailyGuess('3213', '1233');
    expect(a).toEqual(b);
  });
});
