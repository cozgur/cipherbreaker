import { findOpponent, mockOpponents, pickRandomOpponent } from '../mockOpponents';

describe('mockOpponents', () => {
  it('ships with twenty opponents (Phase 7A.1 expansion from 10)', () => {
    expect(mockOpponents).toHaveLength(20);
  });

  it('every opponent has a level in the SPEC §6 range (3–47)', () => {
    for (const opponent of mockOpponents) {
      expect(opponent.level).toBeGreaterThanOrEqual(3);
      expect(opponent.level).toBeLessThanOrEqual(47);
    }
  });

  it('at least 75% of opponents are online (matchmaking pool not empty)', () => {
    const online = mockOpponents.filter((o) => o.isOnline).length;
    expect(online / mockOpponents.length).toBeGreaterThanOrEqual(0.75);
  });

  it('has unique ids', () => {
    const ids = new Set(mockOpponents.map((o) => o.id));
    expect(ids.size).toBe(mockOpponents.length);
  });

  it('findOpponent returns the row for a known id and undefined otherwise', () => {
    expect(findOpponent('opp-1')?.username).toBe('shadowHunter47');
    expect(findOpponent('nope')).toBeUndefined();
  });

  it('pickRandomOpponent is deterministic when seeded', () => {
    const a = pickRandomOpponent(0);
    const b = pickRandomOpponent(0);
    expect(a).toBe(b);
  });

  it('pickRandomOpponent prefers online opponents', () => {
    const onlineIds = new Set(mockOpponents.filter((o) => o.isOnline).map((o) => o.id));
    for (let seed = 0; seed < 20; seed += 1) {
      const picked = pickRandomOpponent(seed);
      expect(onlineIds.has(picked.id)).toBe(true);
    }
  });
});
