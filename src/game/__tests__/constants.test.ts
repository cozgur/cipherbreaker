import {
  AD_COOLDOWN_MS,
  BLITZ_GRACE_PERIOD_MS,
  BLITZ_TIME_LIMIT_MS,
  BOT_THINK_MAX_MS,
  BOT_THINK_MIN_MS,
  DAILY_AD_LIMIT,
  DAILY_AD_REWARD,
  FILTER_CHUNK_SIZE,
  SECRET_LENGTH,
  SUDDEN_DEATH_MAX_GUESSES,
} from '../constants';

describe('mode-agnostic constants', () => {
  it('SECRET_LENGTH is the SPEC §6 value', () => {
    expect(SECRET_LENGTH).toBe(4);
  });

  it('bot thinking window is a positive interval (min < max)', () => {
    expect(BOT_THINK_MIN_MS).toBeGreaterThan(0);
    expect(BOT_THINK_MIN_MS).toBeLessThan(BOT_THINK_MAX_MS);
  });

  it('Blitz grace period is shorter than the round limit', () => {
    expect(BLITZ_GRACE_PERIOD_MS).toBeGreaterThan(0);
    expect(BLITZ_GRACE_PERIOD_MS).toBeLessThan(BLITZ_TIME_LIMIT_MS);
  });

  it('Sudden Death budget is positive and small enough for the UI counter', () => {
    expect(SUDDEN_DEATH_MAX_GUESSES).toBeGreaterThan(0);
    expect(SUDDEN_DEATH_MAX_GUESSES).toBeLessThanOrEqual(9);
  });

  it('daily ad reward and limit are economically meaningful', () => {
    expect(DAILY_AD_LIMIT).toBeGreaterThan(0);
    expect(DAILY_AD_REWARD).toBeGreaterThan(0);
  });

  it('filter chunk size keeps each batch under a frame budget', () => {
    expect(FILTER_CHUNK_SIZE).toBeGreaterThanOrEqual(100);
    expect(FILTER_CHUNK_SIZE).toBeLessThanOrEqual(2000);
  });

  it('reserves an ad cooldown for Phase 7B', () => {
    expect(AD_COOLDOWN_MS).toBeGreaterThan(0);
  });
});
