import type { DailyResultSummary } from '../types';
import { formatDailyShare, formatHintSuffix } from '../share';

const baseTrail = [
  { guess: '1234', plus: 1, minus: 2, isWin: false },
  { guess: '5678', plus: 0, minus: 3, isWin: false },
  { guess: '4321', plus: 2, minus: 1, isWin: false },
  { guess: '4231', plus: 4, minus: 0, isWin: true },
];

const baseResult = (overrides: Partial<DailyResultSummary> = {}): DailyResultSummary => ({
  date: '2026-05-01',
  digits: 4,
  turnLimit: 10,
  turnsUsed: 4,
  success: true,
  secret: '4231',
  feedbackTrail: baseTrail,
  hintsUsed: 0,
  ...overrides,
});

describe('formatHintSuffix', () => {
  it('zero hints → pure-skill suffix', () => {
    expect(formatHintSuffix(0)).toBe('✨ pure skill');
  });

  it('one hint → singular phrasing', () => {
    expect(formatHintSuffix(1)).toBe('(1 hint used)');
  });

  it('multiple hints → plural', () => {
    expect(formatHintSuffix(2)).toBe('(2 hints used)');
    expect(formatHintSuffix(5)).toBe('(5 hints used)');
  });
});

describe('formatDailyShare', () => {
  it('emits the canonical success payload (Day #1, pure-skill suffix)', () => {
    const out = formatDailyShare(baseResult());
    const lines = out.split('\n');
    expect(lines[0]).toBe('CipherBreaker Day #1  4/10');
    expect(lines[1]).toBe('+1 -2');
    expect(lines[2]).toBe('+0 -3');
    expect(lines[3]).toBe('+2 -1');
    expect(lines[4]).toBe('+4 ✓');
    expect(lines[5]).toBe('✨ pure skill');
    expect(lines[6]).toBe('cipherbreaker.app');
  });

  it('with hints — replaces the suffix line, trail unchanged', () => {
    const out = formatDailyShare(baseResult({ hintsUsed: 2 }));
    expect(out).toContain('(2 hints used)');
    expect(out).not.toContain('pure skill');
  });

  it('failure path — headline shows turnsUsed=turnLimit, trail still complete', () => {
    const failureTrail = Array.from({ length: 10 }, () => ({
      guess: '1111',
      plus: 0,
      minus: 0,
      isWin: false,
    }));
    const out = formatDailyShare(
      baseResult({
        success: false,
        turnsUsed: 10,
        feedbackTrail: failureTrail,
        hintsUsed: 1,
      }),
    );
    const lines = out.split('\n');
    expect(lines[0]).toBe('CipherBreaker Day #1  10/10');
    // Final row should NOT carry the ✓ on a failure (no isWin).
    expect(lines[10]).toBe('+0 -0');
    expect(out).toContain('(1 hint used)');
  });

  it('header date scales with calendarDayIndex (Day #30 example)', () => {
    const out = formatDailyShare(baseResult({ date: '2026-05-30' }));
    expect(out.split('\n')[0]).toBe('CipherBreaker Day #30  4/10');
  });

  it('always ends with the share URL placeholder', () => {
    const out = formatDailyShare(baseResult());
    expect(out.split('\n').at(-1)).toBe('cipherbreaker.app');
  });
});
