import type { DailyResultSummary } from '../types';
import { buildBannerCopy, getDailyBannerState, timeUntilNextDaily } from '../banner';

const successResult = (date: string): DailyResultSummary => ({
  date,
  digits: 4,
  turnLimit: 6,
  turnsUsed: 3,
  success: true,
  secret: '4321',
  feedbackTrail: [],
});

const failureResult = (date: string): DailyResultSummary => ({
  ...successResult(date),
  success: false,
  turnsUsed: 6,
});

describe('getDailyBannerState', () => {
  it('returns "fresh" when there is no recorded result', () => {
    expect(getDailyBannerState('2026-05-01', null)).toBe('fresh');
  });

  it('returns "fresh" when the recorded result is for a different date', () => {
    expect(getDailyBannerState('2026-05-02', successResult('2026-05-01'))).toBe('fresh');
  });

  it('returns "cracked" when today has a successful result', () => {
    expect(getDailyBannerState('2026-05-01', successResult('2026-05-01'))).toBe('cracked');
  });

  it('returns "failed" when today has a failed result', () => {
    expect(getDailyBannerState('2026-05-01', failureResult('2026-05-01'))).toBe('failed');
  });
});

describe('timeUntilNextDaily', () => {
  it('formats a normal mid-day remainder ("14h 32m")', () => {
    // 09:28 local; midnight is in 14h 32m exactly.
    const now = new Date(2026, 4, 1, 9, 28, 0);
    expect(timeUntilNextDaily(now)).toBe('14h 32m');
  });

  it('drops the hours unit when under one hour remains', () => {
    const now = new Date(2026, 4, 1, 23, 17, 0);
    expect(timeUntilNextDaily(now)).toBe('43m');
  });

  it('returns "0m" exactly at midnight (boundary)', () => {
    const now = new Date(2026, 4, 1, 0, 0, 0);
    // Midnight to next midnight is 24h, so this should be 24h 0m.
    expect(timeUntilNextDaily(now)).toBe('24h 0m');
  });

  it('rounds minutes down (no mid-second jump)', () => {
    const now = new Date(2026, 4, 1, 9, 28, 45); // 14h 31m 15s remaining
    expect(timeUntilNextDaily(now)).toBe('14h 31m');
  });

  it('handles month-end rollover (May 31 → June 1)', () => {
    const now = new Date(2026, 4, 31, 22, 0, 0);
    expect(timeUntilNextDaily(now)).toBe('2h 0m');
  });

  it('handles year-end rollover (Dec 31 → Jan 1)', () => {
    const now = new Date(2026, 11, 31, 23, 30, 0);
    expect(timeUntilNextDaily(now)).toBe('30m');
  });
});

describe('buildBannerCopy', () => {
  const config = { digits: 4, turnLimit: 6 };

  it('fresh state shows the puzzle CTA + tier + countdown', () => {
    const copy = buildBannerCopy('fresh', config, 1, '14h 32m', null, 0);
    expect(copy.headline).toContain("Today's puzzle");
    expect(copy.subline).toContain('Day #1');
    expect(copy.subline).toContain('4 digits');
    expect(copy.subline).toContain('14h 32m');
  });

  it('cracked state shows the turn ratio + streak + countdown', () => {
    const result = { ...successResult('2026-05-01'), turnsUsed: 3, turnLimit: 6 };
    const copy = buildBannerCopy('cracked', config, 1, '14h 32m', result, 12);
    expect(copy.headline).toContain('Cracked in 3/6');
    expect(copy.subline).toContain('Streak 12');
    expect(copy.subline).toContain('14h 32m');
  });

  it('failed state shows day number + streak-broken note + countdown', () => {
    const copy = buildBannerCopy(
      'failed',
      config,
      1,
      '14h 32m',
      failureResult('2026-05-01'),
      0,
    );
    expect(copy.headline).toContain('not cracked');
    expect(copy.subline).toContain('Streak broken');
    expect(copy.subline).toContain('14h 32m');
  });

  it('falls back to the fresh copy if state=cracked but lastResult is null (defensive)', () => {
    const copy = buildBannerCopy('cracked', config, 1, '14h 32m', null, 0);
    expect(copy.headline).toContain("Today's puzzle");
  });
});
